class BackfillCareerRoiDemandFields < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL
      UPDATE career_roi
      SET demand_rank = s.rank,
          avg_annual_openings = s.avg_annual_openings,
          projected_growth_percent = s.percent_change,
          demand_score = CASE
            WHEN s.rank IS NOT NULL OR s.percent_change IS NOT NULL THEN
              (CASE WHEN s.rank IS NOT NULL AND s.rank <> 0 THEN (1.0 / s.rank) * 0.5 ELSE 0 END)
              + (CASE WHEN s.percent_change IS NOT NULL AND s.percent_change <> 0
                      THEN (s.percent_change / 100.0) * 0.3 ELSE 0 END)
            ELSE NULL
          END,
          updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (state_fips, occ_code)
          state_fips, occ_code, rank, avg_annual_openings, percent_change
        FROM state_high_demand_careers
        WHERE demand_metric = 'percent_change'
        ORDER BY state_fips, occ_code, projection_type
      ) s
      WHERE s.occ_code = career_roi.occupation_code
        AND s.state_fips = CASE WHEN career_roi.area_code = '99' THEN '00' ELSE career_roi.area_code END
    SQL
  end

  def down
    execute <<~SQL
      UPDATE career_roi
      SET demand_rank = NULL,
          avg_annual_openings = NULL,
          projected_growth_percent = NULL,
          demand_score = NULL
    SQL
  end
end
