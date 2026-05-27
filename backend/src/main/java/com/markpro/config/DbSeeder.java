package com.markpro.config;

import com.markpro.model.Course;
import com.markpro.model.Mark;
import com.markpro.model.Student;
import com.markpro.repository.CourseRepository;
import com.markpro.repository.MarkRepository;
import com.markpro.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Component
public class DbSeeder implements CommandLineRunner {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private MarkRepository markRepository;

    @Override
    public void run(String... args) throws Exception {
        if (studentRepository.count() > 0) {
            return; // Database already seeded
        }

        // 1. Seed Courses
        List<Course> courses = new ArrayList<>();
        courses.add(new Course("MATH101", "Introduction to Calculus", 4));
        courses.add(new Course("CS102", "Fundamentals of Computer Science", 4));
        courses.add(new Course("HIST201", "World History", 3));
        courses.add(new Course("PHYS301", "General Physics", 4));
        courses.add(new Course("LIT110", "Modern Literature", 3));
        courseRepository.saveAll(courses);

        // 2. Generate 150+ Students across 3 Institutions
        String[] institutions = {"Aegis High", "Beacon Academy", "Caldera Institute"};
        String[] firstNames = {
            "Liam", "Olivia", "Noah", "Emma", "Oliver", "Ava", "Elijah", "Charlotte", "William", "Sophia",
            "James", "Amelia", "Benjamin", "Isabella", "Lucas", "Mia", "Henry", "Evelyn", "Alexander", "Harper",
            "Mason", "Camila", "Michael", "Gianna", "Ethan", "Abigail", "Daniel", "Luna", "Jacob", "Ella",
            "Logan", "Elizabeth", "Jackson", "Sofia", "Levi", "Avery", "Sebastian", "Scarlett", "Mateo", "Emily"
        };
        String[] lastNames = {
            "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
            "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
            "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
            "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
        };

        Random random = new Random(42); // Static seed for deterministic generation
        List<Student> students = new ArrayList<>();
        
        int totalStudentsToCreate = 155;
        for (int i = 0; i < totalStudentsToCreate; i++) {
            String firstName = firstNames[random.nextInt(firstNames.length)];
            String lastName = lastNames[random.nextInt(lastNames.length)];
            // Make name unique by appending number if necessary, but with 40x40 combinations = 1600 it's mostly unique anyway
            String name = firstName + " " + lastName;
            String email = firstName.toLowerCase() + "." + lastName.toLowerCase() + (i + 1) + "@school.edu";
            String institution = institutions[i % institutions.length]; // Even distribution

            students.add(new Student(name, email, institution));
        }
        studentRepository.saveAll(students);

        // 3. Register students in courses and seed marks
        List<Mark> marks = new ArrayList<>();
        
        for (Student student : students) {
            // Assign 2 to 3 courses randomly
            int coursesToAssign = 2 + random.nextInt(2); // 2 or 3 courses
            List<Course> assignedCourses = new ArrayList<>();
            
            while (assignedCourses.size() < coursesToAssign) {
                Course randomCourse = courses.get(random.nextInt(courses.size()));
                if (!assignedCourses.contains(randomCourse)) {
                    assignedCourses.add(randomCourse);
                }
            }

            for (Course course : assignedCourses) {
                // Generate grades with realistic distributions:
                // Aegis High has standard high school grades (Mean around 72)
                // Beacon Academy is prep school (Mean around 82)
                // Caldera Institute is a hard engineering college (Mean around 58 - perfect for curving!)
                double mean;
                double stdDev;
                if ("Beacon Academy".equals(student.getInstitution())) {
                    mean = 82.0;
                    stdDev = 10.0;
                } else if ("Caldera Institute".equals(student.getInstitution())) {
                    mean = 58.0;
                    stdDev = 15.0;
                } else {
                    mean = 72.0;
                    stdDev = 12.0;
                }

                double assignment = generateGaussianGrade(random, mean + 5, stdDev);
                double midterm = generateGaussianGrade(random, mean, stdDev);
                double finalExam = generateGaussianGrade(random, mean - 3, stdDev);

                Mark mark = new Mark(student, course, assignment, midterm, finalExam);
                // Compute weighted grade based on standard weights (30%, 30%, 40%)
                mark.calculateWeightedScore(0.3, 0.3, 0.4);
                mark.setCurvedScore(mark.getWeightedScore()); // Default matches weighted
                marks.add(mark);
            }
        }
        markRepository.saveAll(marks);
        
        System.out.println(">>> SEEDING COMPLETE! Seeded " + courses.size() + " courses, " + 
                students.size() + " students, and " + marks.size() + " grade records.");
    }

    private double generateGaussianGrade(Random random, double mean, double stdDev) {
        double grade = mean + (random.nextGaussian() * stdDev);
        // Cap between 0 and 100
        grade = Math.max(0.0, Math.min(100.0, grade));
        // Round to 1 decimal place
        return Math.round(grade * 10.0) / 10.0;
    }
}
