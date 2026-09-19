require "test_helper"

class SearchTokenizerTest < ActiveSupport::TestCase
  test "keeps content words from a natural-language query" do
    assert_equal %w[office degree 50k],
      SearchTokenizer.terms("I want an office job with no degree that pays $50k")
  end

  test "returns empty for function words only" do
    assert_equal [], SearchTokenizer.terms("I want a")
  end

  test "keeps a plain keyword as one term" do
    assert_equal %w[nurse], SearchTokenizer.terms("nurse")
  end

  test "dedupes and caps long input at ten terms" do
    terms = SearchTokenizer.terms(("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu " * 3).strip)
    assert_equal 10, terms.size
    assert_equal terms.uniq, terms
  end
end
