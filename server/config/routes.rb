Rails.application.routes.draw do
  namespace :api do
    resources :careers, only: [:index, :show]
  end

  get "up" => "rails/health#show", as: :rails_health_check

  root "rails/health#show"
end
