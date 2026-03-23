Rails.application.routes.draw do
  namespace :api do
    resources :careers, only: [ :index, :show ]
    resources :swipes, only: [ :index, :create, :destroy ] do
      collection do
        get :liked
      end
    end
    resources :roi, only: [ :index, :show ] do
      collection do
        get :by_salary
        get :by_roi
        get :by_breakeven
        get :search
      end
    end
    resources :areas, only: [] do
      collection do
        get :states
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check

  root "rails/health#show"
end
