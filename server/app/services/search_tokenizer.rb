# Splits free-text search input into matchable terms.
#
# Pure function words, short fragments and bare numbers never match
# occupation text, so they are dropped. An empty result means the input
# is a plain keyword and callers should use single-term matching.
class SearchTokenizer
  STOPWORDS = %w[
    i me my we us you your he she it they them
    this that these those
    an a the and or of to in on for with without from at as
    is are was were be been being
    have has had do does did will would can could should
    want wants wanted need needs needed looking look looks
    get got like just really very more most
    not dont job jobs work working career careers
    pay pays paying paid salary salaries plus per
  ].freeze
  MIN_LENGTH = 3
  MAX_TERMS = 10

  def self.terms(text)
    words = text.to_s.downcase.scan(/[a-z0-9]+/)
    words = words.select { |w| w.length >= MIN_LENGTH && w.match?(/[a-z]/) }
    words -= STOPWORDS
    words.uniq.sort_by { |w| -w.length }.first(MAX_TERMS)
  end
end
