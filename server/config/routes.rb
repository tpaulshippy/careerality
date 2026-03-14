Rails.application.routes.draw do
  namespace :api do
    resources :careers, only: [:index, :show]
    resources :roi, only: [:index, :show] do
      collection do
        get :by_salary
        get :by_roi
        get :by_breakeven
        get :search
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check

  root "rails/health#show"
end
