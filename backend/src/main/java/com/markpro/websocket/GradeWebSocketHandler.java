package com.markpro.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.markpro.model.Mark;
import com.markpro.repository.MarkRepository;
import com.markpro.service.GradeCalculationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class GradeWebSocketHandler extends TextWebSocketHandler {

    private final CopyOnWriteArrayList<WebSocketSession> sessions = new CopyOnWriteArrayList<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private MarkRepository markRepository;

    @Autowired
    private GradeCalculationService gradeCalculationService;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        // Send connection success acknowledgement
        session.sendMessage(new TextMessage("{\"type\":\"CONNECTION_ACK\",\"status\":\"CONNECTED\"}"));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        try {
            JsonNode jsonNode = objectMapper.readTree(payload);
            String type = jsonNode.has("type") ? jsonNode.get("type").asText() : "";

            if ("GRADE_UPDATE".equals(type)) {
                handleGradeUpdate(jsonNode, session);
            } else if ("APPLY_CURVE".equals(type)) {
                handleApplyCurve(jsonNode, session);
            } else if ("PING".equals(type)) {
                session.sendMessage(new TextMessage("{\"type\":\"PONG\"}"));
            }
        } catch (Exception e) {
            session.sendMessage(new TextMessage("{\"type\":\"ERROR\",\"message\":\"" + e.getMessage() + "\"}"));
        }
    }

    private void handleGradeUpdate(JsonNode node, WebSocketSession senderSession) throws IOException {
        Long markId = node.get("markId").asLong();
        
        Optional<Mark> optMark = markRepository.findById(markId);
        if (optMark.isPresent()) {
            Mark mark = optMark.get();
            
            if (node.has("assignmentScore")) {
                mark.setAssignmentScore(node.get("assignmentScore").asDouble());
            }
            if (node.has("midtermScore")) {
                mark.setMidtermScore(node.get("midtermScore").asDouble());
            }
            if (node.has("finalScore")) {
                mark.setFinalScore(node.get("finalScore").asDouble());
            }

            // Recalculate weights (Default 30%, 30%, 40%)
            double w1 = node.has("assignmentWeight") ? node.get("assignmentWeight").asDouble() : 0.3;
            double w2 = node.has("midtermWeight") ? node.get("midtermWeight").asDouble() : 0.3;
            double w3 = node.has("finalWeight") ? node.get("finalWeight").asDouble() : 0.4;
            
            mark.calculateWeightedScore(w1, w2, w3);
            
            // Reapply existing curve if applicable, or keep curved = weighted
            mark.setCurvedScore(mark.getWeightedScore());
            
            markRepository.save(mark);

            // Broadcast the update to all clients
            broadcastMessage("{\"type\":\"GRADE_UPDATED\",\"markId\":" + markId + 
                    ",\"assignmentScore\":" + mark.getAssignmentScore() + 
                    ",\"midtermScore\":" + mark.getMidtermScore() + 
                    ",\"finalScore\":" + mark.getFinalScore() + 
                    ",\"weightedScore\":" + mark.getWeightedScore() + 
                    ",\"curvedScore\":" + mark.getCurvedScore() + 
                    ",\"letterGrade\":\"" + mark.getLetterGrade() + "\"}");
        }
    }

    private void handleApplyCurve(JsonNode node, WebSocketSession senderSession) throws IOException {
        String curveType = node.get("curveType").asText();
        Long courseId = node.get("courseId").asLong();
        String institution = node.get("institution").asText();

        List<Mark> marks;
        if (institution != null && !institution.isEmpty() && !"ALL".equals(institution.toUpperCase())) {
            marks = markRepository.findByStudentInstitutionAndCourseId(institution, courseId);
        } else {
            marks = markRepository.findByCourseId(courseId);
        }

        if (marks.isEmpty()) {
            senderSession.sendMessage(new TextMessage("{\"type\":\"WARNING\",\"message\":\"No marks found matching criteria.\"}"));
            return;
        }

        switch (curveType.toUpperCase()) {
            case "LINEAR":
                double bonus = node.has("bonusPoints") ? node.get("bonusPoints").asDouble() : 5.0;
                double cap = node.has("maxCap") ? node.get("maxCap").asDouble() : 100.0;
                gradeCalculationService.applyLinearCurve(marks, bonus, cap);
                break;
            case "SCALING_LINEAR":
                gradeCalculationService.applyScalingLinearCurve(marks);
                break;
            case "ROOT":
                gradeCalculationService.applyRootCurve(marks);
                break;
            case "BELL":
                double targetMean = node.has("targetMean") ? node.get("targetMean").asDouble() : 75.0;
                double targetStdDev = node.has("targetStdDev") ? node.get("targetStdDev").asDouble() : 10.0;
                gradeCalculationService.applyBellCurve(marks, targetMean, targetStdDev);
                break;
            case "RESET":
            default:
                gradeCalculationService.resetCurves(marks);
                break;
        }

        markRepository.saveAll(marks);

        // Broadcast that a curve was applied so all clients refetch/refresh
        broadcastMessage("{\"type\":\"CURVE_APPLIED\",\"curveType\":\"" + curveType + "\",\"courseId\":" + courseId + ",\"institution\":\"" + institution + "\"}");
    }

    public void broadcastMessage(String textMessage) {
        TextMessage msg = new TextMessage(textMessage);
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(msg);
                } catch (IOException e) {
                    // Ignore or remove dead session
                }
            }
        }
    }
}
