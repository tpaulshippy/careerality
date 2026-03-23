class Api::AreasController < ApplicationController
  def states
    # Get state-level entries from career_roi (area codes are numeric, length <= 2, no comma in name)
    states = CareerRoi.select(:area_code, :area_name)
                      .distinct
                      .where("area_code ~ '^[0-9]+$'")
                      .where("length(area_code) <= 2")
                      .where("area_name NOT LIKE '%,%'")
                      .order(:area_name)

    render json: { states: states.map { |s| { area_code: s.area_code, area_name: s.area_name } } }
  end
end
