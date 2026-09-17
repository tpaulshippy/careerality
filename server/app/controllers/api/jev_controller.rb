class Api::JevController < ApplicationController
  # POST /api/jev/qa_score — score one generated narrative (demo/test surface
  # for the JevQaJudgeService batch gate in populate_career_contents.rb).
  # Falls back gracefully when TYPESAFE_API_KEY is missing (see service).
  def qa_score
    score = JevQaJudgeService.score(
      narrative: params[:narrative].to_s,
      onet_tasks: Array(params[:onet_tasks]),
      occupation_code: params[:occupation_code].to_s
    )
    render json: { score: score.to_h }
  end
end
