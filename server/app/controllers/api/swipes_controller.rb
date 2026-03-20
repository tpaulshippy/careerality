class Api::SwipesController < ApplicationController
  def index
    swipes = Swipe.where(user_id: params[:user_id]).order(created_at: :desc)
    render json: { swipes: swipes.as_json }
  end

  def create
    swipe = Swipe.new(swipe_params)
    if swipe.save
      render json: swipe.as_json, status: :created
    else
      render json: { error: swipe.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def swipe_params
    params.permit(:career_id, :user_id, :direction, :feedback)
  end
end
