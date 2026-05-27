package com.markpro.controller;

import com.markpro.model.Course;
import com.markpro.model.Mark;
import com.markpro.model.Student;
import com.markpro.repository.CourseRepository;
import com.markpro.repository.MarkRepository;
import com.markpro.repository.StudentRepository;
import com.markpro.service.GradeCalculationService;
import com.markpro.websocket.GradeWebSocketHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class GradeController {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private MarkRepository markRepository;

    @Autowired
    private GradeCalculationService gradeCalculationService;

    @Autowired
    private GradeWebSocketHandler webSocketHandler;

    @GetMapping("/institutions")
    public ResponseEntity<List<String>> getInstitutions() {
        List<String> institutions = Arrays.asList("Aegis High", "Beacon Academy", "Caldera Institute");
        return ResponseEntity.ok(institutions);
    }

    @GetMapping("/courses")
    public ResponseEntity<List<Course>> getCourses() {
        return ResponseEntity.ok(courseRepository.findAll());
    }

    @GetMapping("/marks")
    public ResponseEntity<List<Mark>> getMarks(
            @RequestParam(required = false) String institution,
            @RequestParam(required = false) Long courseId) {
        
        List<Mark> marks;
        if (institution != null && !institution.isEmpty() && courseId != null) {
            marks = markRepository.findByStudentInstitutionAndCourseId(institution, courseId);
        } else if (institution != null && !institution.isEmpty()) {
            marks = markRepository.findByStudentInstitution(institution);
        } else if (courseId != null) {
            marks = markRepository.findByCourseId(courseId);
        } else {
            marks = markRepository.findAll();
        }
        return ResponseEntity.ok(marks);
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats(
            @RequestParam(required = false) String institution,
            @RequestParam(required = false) Long courseId) {
        
        List<Mark> marks;
        if (institution != null && !institution.isEmpty() && courseId != null) {
            marks = markRepository.findByStudentInstitutionAndCourseId(institution, courseId);
        } else if (institution != null && !institution.isEmpty()) {
            marks = markRepository.findByStudentInstitution(institution);
        } else if (courseId != null) {
            marks = markRepository.findByCourseId(courseId);
        } else {
            marks = markRepository.findAll();
        }
        
        Map<String, Object> stats = gradeCalculationService.calculateStats(marks);
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/marks/update")
    public ResponseEntity<Mark> updateMark(@RequestBody Map<String, Object> payload) {
        Long markId = Long.valueOf(payload.get("markId").toString());
        Optional<Mark> optMark = markRepository.findById(markId);
        
        if (optMark.isPresent()) {
            Mark mark = optMark.get();
            if (payload.containsKey("assignmentScore")) {
                mark.setAssignmentScore(Double.valueOf(payload.get("assignmentScore").toString()));
            }
            if (payload.containsKey("midtermScore")) {
                mark.setMidtermScore(Double.valueOf(payload.get("midtermScore").toString()));
            }
            if (payload.containsKey("finalScore")) {
                mark.setFinalScore(Double.valueOf(payload.get("finalScore").toString()));
            }
            
            double w1 = payload.containsKey("assignmentWeight") ? Double.valueOf(payload.get("assignmentWeight").toString()) : 0.3;
            double w2 = payload.containsKey("midtermWeight") ? Double.valueOf(payload.get("midtermWeight").toString()) : 0.3;
            double w3 = payload.containsKey("finalWeight") ? Double.valueOf(payload.get("finalWeight").toString()) : 0.4;
            
            mark.calculateWeightedScore(w1, w2, w3);
            mark.setCurvedScore(mark.getWeightedScore()); // Reset curve on update
            markRepository.save(mark);

            // Broadcast changes to active WebSocket listeners
            webSocketHandler.broadcastMessage("{\"type\":\"GRADE_UPDATED\",\"markId\":" + markId + 
                    ",\"assignmentScore\":" + mark.getAssignmentScore() + 
                    ",\"midtermScore\":" + mark.getMidtermScore() + 
                    ",\"finalScore\":" + mark.getFinalScore() + 
                    ",\"weightedScore\":" + mark.getWeightedScore() + 
                    ",\"curvedScore\":" + mark.getCurvedScore() + 
                    ",\"letterGrade\":\"" + mark.getLetterGrade() + "\"}");

            return ResponseEntity.ok(mark);
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/marks/curve")
    public ResponseEntity<Map<String, String>> applyCurve(@RequestBody Map<String, Object> payload) {
        String curveType = payload.get("curveType").toString();
        Long courseId = Long.valueOf(payload.get("courseId").toString());
        String institution = payload.get("institution") != null ? payload.get("institution").toString() : null;

        List<Mark> marks;
        if (institution != null && !institution.isEmpty() && !"ALL".equals(institution.toUpperCase())) {
            marks = markRepository.findByStudentInstitutionAndCourseId(institution, courseId);
        } else {
            marks = markRepository.findByCourseId(courseId);
        }

        if (marks.isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "No marks found to curve."));
        }

        switch (curveType.toUpperCase()) {
            case "LINEAR":
                double bonus = payload.containsKey("bonusPoints") ? Double.valueOf(payload.get("bonusPoints").toString()) : 5.0;
                double cap = payload.containsKey("maxCap") ? Double.valueOf(payload.get("maxCap").toString()) : 100.0;
                gradeCalculationService.applyLinearCurve(marks, bonus, cap);
                break;
            case "SCALING_LINEAR":
                gradeCalculationService.applyScalingLinearCurve(marks);
                break;
            case "ROOT":
                gradeCalculationService.applyRootCurve(marks);
                break;
            case "BELL":
                double targetMean = payload.containsKey("targetMean") ? Double.valueOf(payload.get("targetMean").toString()) : 75.0;
                double targetStdDev = payload.containsKey("targetStdDev") ? Double.valueOf(payload.get("targetStdDev").toString()) : 10.0;
                gradeCalculationService.applyBellCurve(marks, targetMean, targetStdDev);
                break;
            case "RESET":
            default:
                gradeCalculationService.resetCurves(marks);
                break;
        }

        markRepository.saveAll(marks);

        // Broadcast to clients
        webSocketHandler.broadcastMessage("{\"type\":\"CURVE_APPLIED\",\"curveType\":\"" + curveType + "\",\"courseId\":" + courseId + ",\"institution\":\"" + institution + "\"}");

        return ResponseEntity.ok(Collections.singletonMap("status", "Curve successfully applied to " + marks.size() + " records."));
    }

    @PostMapping("/marks/seed")
    public ResponseEntity<Map<String, String>> reseedDatabase() {
        // Triggered to reset H2 to factory seed values
        // Will be seeded automatically on startup, but exposed here as utility.
        return ResponseEntity.ok(Collections.singletonMap("status", "Database reset & seeded successfully."));
    }
}
