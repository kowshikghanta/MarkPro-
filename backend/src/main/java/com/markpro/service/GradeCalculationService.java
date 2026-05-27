package com.markpro.service;

import com.markpro.model.Mark;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class GradeCalculationService {

    /**
     * Recalculates weighted grades based on given weights.
     */
    public void recalculateWeights(List<Mark> marks, double assignmentWeight, double midtermWeight, double finalWeight) {
        for (Mark mark : marks) {
            mark.calculateWeightedScore(assignmentWeight, midtermWeight, finalWeight);
        }
    }

    /**
     * Applies a Linear Curve.
     * New Score = Old Score + bonusPoints, capped at maxCap.
     */
    public void applyLinearCurve(List<Mark> marks, double bonusPoints, double maxCap) {
        for (Mark mark : marks) {
            double oldScore = mark.getWeightedScore();
            double newScore = Math.min(maxCap, oldScore + bonusPoints);
            mark.setCurvedScore(Math.round(newScore * 100.0) / 100.0);
        }
    }

    /**
     * Applies a Scaling Linear Curve so that the highest grade matches 100%.
     * New Score = Old Score * (100.0 / MaxRawGrade).
     */
    public void applyScalingLinearCurve(List<Mark> marks) {
        if (marks == null || marks.isEmpty()) return;
        
        double maxScore = marks.stream()
                .mapToDouble(Mark::getWeightedScore)
                .max()
                .orElse(100.0);
                
        if (maxScore <= 0.0) return;

        double scaleFactor = 100.0 / maxScore;
        for (Mark mark : marks) {
            double oldScore = mark.getWeightedScore();
            double newScore = oldScore * scaleFactor;
            mark.setCurvedScore(Math.round(newScore * 100.0) / 100.0);
        }
    }

    /**
     * Applies a Root Curve.
     * New Score = 10 * sqrt(Old Score).
     */
    public void applyRootCurve(List<Mark> marks) {
        for (Mark mark : marks) {
            double oldScore = mark.getWeightedScore();
            double newScore = 10.0 * Math.sqrt(oldScore);
            mark.setCurvedScore(Math.round(newScore * 100.0) / 100.0);
        }
    }

    /**
     * Applies a Gaussian Bell Curve Scale.
     * Normalizes the class score to Z-scores, then maps them to a target distribution (e.g. Mean = 75, StdDev = 10).
     */
    public void applyBellCurve(List<Mark> marks, double targetMean, double targetStdDev) {
        if (marks == null || marks.size() < 2) {
            // Can't calculate standard deviation with less than 2 elements
            for (Mark m : marks) {
                m.setCurvedScore(m.getWeightedScore());
            }
            return;
        }

        // 1. Calculate Mean
        double sum = 0.0;
        for (Mark m : marks) {
            sum += m.getWeightedScore();
        }
        double mean = sum / marks.size();

        // 2. Calculate Standard Deviation
        double varianceSum = 0.0;
        for (Mark m : marks) {
            varianceSum += Math.pow(m.getWeightedScore() - mean, 2);
        }
        double variance = varianceSum / (marks.size() - 1);
        double stdDev = Math.sqrt(variance);

        // Avoid division by zero if all scores are identical
        if (stdDev < 0.01) {
            for (Mark m : marks) {
                // If everyone has the same grade, just shift to target mean
                m.setCurvedScore(targetMean);
            }
            return;
        }

        // 3. Map to new Bell Curve
        for (Mark m : marks) {
            double oldScore = m.getWeightedScore();
            double zScore = (oldScore - mean) / stdDev;
            double newScore = targetMean + (zScore * targetStdDev);
            
            // Cap between 0 and 100
            newScore = Math.max(0.0, Math.min(100.0, newScore));
            m.setCurvedScore(Math.round(newScore * 100.0) / 100.0);
        }
    }

    /**
     * Resets curves back to weighted score.
     */
    public void resetCurves(List<Mark> marks) {
        for (Mark mark : marks) {
            mark.setCurvedScore(mark.getWeightedScore());
        }
    }

    /**
     * Calculates class analytics.
     */
    public Map<String, Object> calculateStats(List<Mark> marks) {
        Map<String, Object> stats = new HashMap<>();
        if (marks == null || marks.isEmpty()) {
            stats.put("average", 0.0);
            stats.put("median", 0.0);
            stats.put("stdDev", 0.0);
            stats.put("passingRate", 0.0);
            stats.put("totalStudents", 0);
            stats.put("atRiskCount", 0);
            stats.put("gradeDistribution", new HashMap<String, Integer>());
            return stats;
        }

        int total = marks.size();
        double sumWeighted = 0.0;
        double sumCurved = 0.0;
        int passingCount = 0;
        int atRiskCount = 0;

        List<Double> curvedScores = new ArrayList<>();
        Map<String, Integer> dist = new HashMap<>();
        dist.put("A", 0);
        dist.put("B", 0);
        dist.put("C", 0);
        dist.put("D", 0);
        dist.put("F", 0);

        for (Mark m : marks) {
            double w = m.getWeightedScore() != null ? m.getWeightedScore() : 0.0;
            double c = m.getCurvedScore() != null ? m.getCurvedScore() : w;
            
            sumWeighted += w;
            sumCurved += c;
            curvedScores.add(c);

            // Grade counts
            String letter = m.getLetterGrade();
            dist.put(letter, dist.getOrDefault(letter, 0) + 1);

            // Passing is >= 60.0 (D or better)
            if (c >= 60.0) {
                passingCount++;
            }

            // At-Risk: score < 60.0, or failing grade
            if (c < 60.0) {
                atRiskCount++;
            }
        }

        Collections.sort(curvedScores);
        double median;
        if (total % 2 == 0) {
            median = (curvedScores.get(total / 2 - 1) + curvedScores.get(total / 2)) / 2.0;
        } else {
            median = curvedScores.get(total / 2);
        }

        double mean = sumCurved / total;

        // Std dev
        double varSum = 0.0;
        for (double val : curvedScores) {
            varSum += Math.pow(val - mean, 2);
        }
        double stdDev = total > 1 ? Math.sqrt(varSum / (total - 1)) : 0.0;

        stats.put("average", Math.round(mean * 100.0) / 100.0);
        stats.put("averageWeighted", Math.round((sumWeighted / total) * 100.0) / 100.0);
        stats.put("median", Math.round(median * 100.0) / 100.0);
        stats.put("stdDev", Math.round(stdDev * 100.0) / 100.0);
        stats.put("passingRate", Math.round(((double) passingCount / total * 100.0) * 100.0) / 100.0);
        stats.put("totalStudents", total);
        stats.put("atRiskCount", atRiskCount);
        stats.put("gradeDistribution", dist);

        // Add a smart recommendation / insight based on class metrics!
        String recommendation;
        if (mean < 65.0) {
            recommendation = "The class average is low (" + Math.round(mean * 10.0)/10.0 + "%). We highly recommend applying a 'Root Curve' or a 'Gaussian Bell Curve' (Target Mean: 75.0) to normalize the grade distribution and rescue at-risk students.";
        } else if (stdDev > 20.0) {
            recommendation = "High standard deviation (" + Math.round(stdDev * 10.0)/10.0 + "%) indicates high performance inequality. Consider reviewing specific assessment weights or applying a Bell Curve to balance grades.";
        } else if (passingCount / (double) total < 0.75) {
            recommendation = "Over 25% of students are currently failing. Consider scaling grades linearly with a small +5 bonus or revising raw assessment thresholds.";
        } else {
            recommendation = "Class performance is solid and well-distributed. No curving action is strictly necessary, but a subtle Linear Curve could reward top performers.";
        }
        stats.put("recommendation", recommendation);

        return stats;
    }
}
