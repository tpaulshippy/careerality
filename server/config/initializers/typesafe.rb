# TypeSafe Jev credentials for System One decisions (Discover ranking, etc.)
# https://github.com/kieranklaassen/ruby_llm-typesafe
#
# Without this, RubyLLM raises ConfigurationError on every :typesafe call and
# callers silently degrade to deterministic fallbacks.
require "ruby_llm"
require "ruby_llm-typesafe"

RubyLLM.configure do |config|
  config.typesafe_api_key = ENV["TYPESAFE_API_KEY"] if ENV["TYPESAFE_API_KEY"].present?
end
