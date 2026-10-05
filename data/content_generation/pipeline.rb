# frozen_string_literal: true

# Shared, dependency-free configuration for the image pipeline.
#
# Deliberately requires nothing beyond stdlib so the generator and uploader can
# load it without pulling in ActiveRecord.

module Pipeline
  # Number of images generated per career, for the in-app slideshow.
  IMAGE_COUNT = 3

  # The shots cycle through framing styles so a career's images read as a sequence
  # rather than three near-identical portraits. Must stay sized to IMAGE_COUNT.
  SHOT_STYLES = [
    {
      framing: 'wide establishing shot',
      direction: 'Pull back far enough to show the whole room and the people around them.'
    },
    {
      framing: 'over-the-shoulder medium shot',
      direction: 'Stay close behind their shoulder, focused on what their hands are doing.'
    },
    {
      framing: 'close detail shot',
      direction: 'Move in tight on their hands and the work itself, the rest of the room falling out of focus.'
    }
  ].freeze

  module_function

  # "11-1011.00", "11-1011" and "111011" all become "111011".
  #
  # This mapping is load-bearing: narrative index keys, image filenames,
  # checkpoint keys, R2 object names and career_profiles lookups all have to agree.
  # If the two representations diverge, generation and upload silently target
  # different objects.
  def compact(code)
    digits = code.to_s.strip.gsub(/[^0-9]/, '')
    digits.length > 6 ? digits[0, 6] : digits
  end

  # "111011" becomes "11-1011.00". Anything that is not exactly six digits is
  # returned unchanged rather than guessed at, since guessing would build a
  # malformed WHERE clause.
  def soc(compact)
    return compact unless compact.to_s =~ /\A\d{6}\z/

    "#{compact[0..1]}-#{compact[2..5]}.00"
  end

  # 1-based slot range actually published to R2.
  def slot?(slot)
    slot.is_a?(Integer) && slot >= 1 && slot <= IMAGE_COUNT
  end
end