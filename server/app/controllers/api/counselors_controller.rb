class Api::CounselorsController < ApplicationController
  def chat
    if params[:user_id].blank? || params[:message].blank?
      render json: { error: "user_id and message are required" }, status: :bad_request
      return
    end

    result = Counselor::Engine.new(user_id: params[:user_id], message: params[:message]).respond
    render json: result
  end
end
