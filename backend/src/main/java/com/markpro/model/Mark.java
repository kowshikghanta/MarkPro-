package com.markpro.model;

import jakarta.persistence.*;

@Entity
@Table(name = "marks", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"student_id", "course_id"})
})
public class Mark {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    private Double assignmentScore; // Weight e.g. 30%
    private Double midtermScore;    // Weight e.g. 30%
    private Double finalScore;      // Weight e.g. 40%

    private Double weightedScore;
    private Double curvedScore;
    private String letterGrade;

    public Mark() {}

    public Mark(Student student, Course course, Double assignmentScore, Double midtermScore, Double finalScore) {
        this.student = student;
        this.course = course;
        this.assignmentScore = assignmentScore;
        this.midtermScore = midtermScore;
        this.finalScore = finalScore;
        calculateWeightedScore(0.3, 0.3, 0.4);
    }

    public void calculateWeightedScore(double w1, double w2, double w3) {
        double a = this.assignmentScore != null ? this.assignmentScore : 0.0;
        double m = this.midtermScore != null ? this.midtermScore : 0.0;
        double f = this.finalScore != null ? this.finalScore : 0.0;
        
        // Normalize weights if they don't sum to 1.0 (but they should sum to 1.0)
        double totalWeight = w1 + w2 + w3;
        if (totalWeight > 0) {
            this.weightedScore = Math.round(((a * w1 + m * w2 + f * w3) / totalWeight) * 100.0) / 100.0;
        } else {
            this.weightedScore = 0.0;
        }
        
        // Default curved score to weighted score until curving is applied
        if (this.curvedScore == null) {
            this.curvedScore = this.weightedScore;
        }
        
        updateLetterGrade();
    }

    public void updateLetterGrade() {
        double score = this.curvedScore != null ? this.curvedScore : (this.weightedScore != null ? this.weightedScore : 0.0);
        if (score >= 90.0) {
            this.letterGrade = "A";
        } else if (score >= 80.0) {
            this.letterGrade = "B";
        } else if (score >= 70.0) {
            this.letterGrade = "C";
        } else if (score >= 60.0) {
            this.letterGrade = "D";
        } else {
            this.letterGrade = "F";
        }
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(Student student) {
        this.student = student;
    }

    public Course getCourse() {
        return course;
    }

    public void setCourse(Course course) {
        this.course = course;
    }

    public Double getAssignmentScore() {
        return assignmentScore;
    }

    public void setAssignmentScore(Double assignmentScore) {
        this.assignmentScore = assignmentScore;
    }

    public Double getMidtermScore() {
        return midtermScore;
    }

    public void setMidtermScore(Double midtermScore) {
        this.midtermScore = midtermScore;
    }

    public Double getFinalScore() {
        return finalScore;
    }

    public void setFinalScore(Double finalScore) {
        this.finalScore = finalScore;
    }

    public Double getWeightedScore() {
        return weightedScore;
    }

    public void setWeightedScore(Double weightedScore) {
        this.weightedScore = weightedScore;
    }

    public Double getCurvedScore() {
        return curvedScore;
    }

    public void setCurvedScore(Double curvedScore) {
        this.curvedScore = curvedScore;
        updateLetterGrade();
    }

    public String getLetterGrade() {
        return letterGrade;
    }

    public void setLetterGrade(String letterGrade) {
        this.letterGrade = letterGrade;
    }
}
