package com.markpro.repository;

import com.markpro.model.Mark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MarkRepository extends JpaRepository<Mark, Long> {
    List<Mark> findByCourseId(Long courseId);
    List<Mark> findByStudentInstitution(String institution);
    List<Mark> findByStudentInstitutionAndCourseId(String institution, Long courseId);
    Optional<Mark> findByStudentIdAndCourseId(Long studentId, Long courseId);
}
