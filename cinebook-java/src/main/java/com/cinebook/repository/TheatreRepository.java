package com.cinebook.repository;

import com.cinebook.entity.Theatre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface TheatreRepository extends JpaRepository<Theatre, Long> {
    List<Theatre> findByCityIgnoreCaseOrderByNameAsc(String city);

    @Query("SELECT DISTINCT t.city FROM Theatre t ORDER BY t.city ASC")
    List<String> findAllDistinctCities();
}
