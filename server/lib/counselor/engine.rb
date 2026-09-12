# frozen_string_literal: true

module Counselor
  # Deterministic, heuristic career counselor.
  #
  # Deliberately NO external AI calls: every reply is assembled locally from
  # keyword-driven intent detection over the career_roi dataset plus the user's
  # own swipe history. That keeps replies instant, free, private, and fully
  # testable offline while still feeling conversational.
  class Engine
    NATIONAL_AREA = "99"
    SUGGESTION_COUNT = 3

    DEFAULT_QUICK_REPLIES = [
      "Recommend careers for me",
      "Explain ROI for registered nurses",
      "Compare software developers vs electricians",
      "What are my next steps?"
    ].freeze

    STOPWORDS = %w[
      a about an and any are as at be best between both by can compare could do
      does explain find for from get give good got had has have hello help hey
      hi how i if in into is it its like me much my next of on one or please
      really return should show so some suggest steps than that the their them
      then there these thing this to up versus vs want was we what when where
      which who why will with would you your
    ].index_by { |word| word }.freeze

    def initialize(user_id:, message:)
      @user_id = user_id
      @message = message.to_s.strip.downcase
    end

    attr_reader :message

    def detect_intent
      return :compare if @message.match?(/\bvs\.?\b|\bversus\b/)
      return :explain_roi if @message.match?(/explain|roi|break[ -]?even|return on investment|worth it/)
      return :next_steps if @message.match?(/next steps?|get started|how (do|can) i (start|become|get)|where (do|should) i start/)
      return :recommend if @message.match?(/recommend|suggest|careers? for me|find me|what should i/)
      return :greeting if greeting?
      :fallback
    end

    def respond
      case detect_intent
      when :compare then compare_response
      when :explain_roi then explain_roi_response
      when :next_steps then next_steps_response
      when :recommend then recommend_response
      else greeting_response
      end
    end

    private

    def greeting?
      @message.match?(/\A(hi+|hey+|hello+|yo|hiya|sup|thanks|thank you|help)\b/) && @message.split.size <= 4
    end

    def greeting_response
      {
        reply: "Hi! I'm your virtual career counselor. I combine your swipes with real salary and ROI data to " \
               "recommend careers, break down education costs, and compare your options. What would you like to explore?",
        quick_replies: DEFAULT_QUICK_REPLIES
      }
    end

    def recommend_response
      likes = liked_careers
      picks = recommendation_pool.first(SUGGESTION_COUNT)
      return fallback_recommendation if picks.empty?

      themes = liked_themes(likes)
      intro =
        if likes.empty?
          "You haven't swiped yet, so here are three high-value careers overall"
        elsif themes[:feedback]
          "Based on your swipe history you've consistently marked careers as \"#{themes[:feedback].tr('_', ' ')}\" — here's why each pick fits"
        else
          "Based on the #{likes.size} #{'career'.pluralize(likes.size)} you've liked"
        end

      lines = picks.each_with_index.map do |pick, index|
        "• #{pick.occupation_name} — #{reason_for(pick, likes, themes, index.zero?)}."
      end

      {
        reply: "#{intro}:\n\n#{lines.join("\n")}",
        suggestions: serialize(picks),
        quick_replies: follow_up_quick_replies(picks)
      }
    end

    def fallback_recommendation
      {
        reply: "I couldn't pull recommendations right now — try asking about a specific career instead.",
        quick_replies: DEFAULT_QUICK_REPLIES
      }
    end

    def explain_roi_response
      career = find_career_in(@message)
      unless career
        return {
          reply: "I couldn't tell which career you meant. Try naming one — for example \"Explain ROI for registered nurses\".",
          quick_replies: DEFAULT_QUICK_REPLIES
        }
      end

      lines = ["Here's the plain-language math for #{career.occupation_name}:"]
      lines << "• Median pay is #{money(career.annual_median_salary)} per year."
      lines << "• Typical education cost runs about #{money(career.education_cost)} (#{career.education_level || 'varies by path'})."
      lines << "• You'd earn back that education spend in roughly #{plural_years(career.years_to_breakeven)}."
      lines << "• That works out to a #{number(career.roi_percentage)}% annual return on the education investment."
      if career.demand_rank.present?
        lines << "• Demand: ranked ##{career.demand_rank} nationally."
      elsif career.projected_growth_percent.present?
        lines << "• Demand: projected growth of #{number(career.projected_growth_percent)}%."
      end

      {
        reply: lines.join("\n"),
        suggestions: serialize([career]),
        quick_replies: [
          "Compare #{career.occupation_name} vs electricians",
          "What are my next steps?",
          "Recommend careers for me"
        ]
      }
    end

    def compare_response
      left_text, right_text = @message.split(/\s+(?:vs\.?|versus)\s+/, 2)
      return explain_roi_response unless right_text

      left = find_career_in(left_text.to_s)
      right = find_career_in(right_text)

      if left.nil? || right.nil?
        missing = left.nil? ? side_label(left_text) : side_label(right_text)
        return {
          reply: "I found #{left&.occupation_name || right&.occupation_name || 'neither career'} but couldn't find \"#{missing}\" in the data. Try another pair?",
          quick_replies: DEFAULT_QUICK_REPLIES
        }
      end
      if left.id == right.id
        return {
          reply: "#{left.occupation_name} vs #{left.occupation_name}? That one's a tie. 😄 Try comparing it against a different career.",
          quick_replies: DEFAULT_QUICK_REPLIES
        }
      end

      { reply: comparison_reply(left, right), suggestions: serialize([left, right]), quick_replies: compare_quick_replies(left) }
    end

    def comparison_reply(a, b)
      wins_a = 0
      lines = ["#{a.occupation_name} vs #{b.occupation_name}:"]

      if a.annual_median_salary.present? && b.annual_median_salary.present?
        winner, loser = [a, b].sort_by { |c| -c.annual_median_salary.to_f }
        wins_a += 1 if winner.id == a.id
        lines << "• Salary: #{winner.occupation_name} pays more — #{money(winner.annual_median_salary)} vs #{money(loser.annual_median_salary)} median."
      end
      if a.education_cost.present? && b.education_cost.present? && a.education_cost != b.education_cost
        cheaper, pricier = [a, b].sort_by { |c| c.education_cost.to_f }
        wins_a += 1 if cheaper.id == a.id
        lines << "• Education cost: #{cheaper.occupation_name} costs less to train for (#{money(cheaper.education_cost)} vs #{money(pricier.education_cost)})."
      end
      if a.years_to_breakeven.present? && b.years_to_breakeven.present? && a.years_to_breakeven != b.years_to_breakeven
        faster, slower = [a, b].sort_by(&:years_to_breakeven)
        wins_a += 1 if faster.id == a.id
        lines << "• Breakeven: #{faster.occupation_name} recovers its cost sooner (#{plural_years(faster.years_to_breakeven)} vs #{plural_years(slower.years_to_breakeven)})."
      end
      if a.roi_percentage.present? && b.roi_percentage.present?
        winner, loser = [a, b].sort_by { |c| -c.roi_percentage.to_f }
        wins_a += 1 if winner.id == a.id
        lines << "• ROI: #{winner.occupation_name} edges it at #{number(winner.roi_percentage)}% vs #{number(loser.roi_percentage)}%."
      end
      if a.demand_rank.present? && b.demand_rank.present? && a.demand_rank != b.demand_rank
        winner, loser = [a, b].sort_by(&:demand_rank)
        wins_a += 1 if winner.id == a.id
        lines << "• Demand: #{winner.occupation_name} ranks higher nationally (##{winner.demand_rank} vs ##{loser.demand_rank})."
      end

      overall = wins_a > ([a, b].size / 2.0) ? a : b
      lines << "Overall, #{overall.occupation_name} comes out slightly ahead on the numbers — but both are solid paths depending on what you value most."
      lines.join("\n")
    end

    def next_steps_response
      likes = liked_careers
      focus = likes.max_by { |c| c.demand_score.to_f } || find_career_in(@message)

      if focus
        skills = top_liked_skills(likes)
        steps = [
          "1. Read the official O*NET profile for #{focus.occupation_name}: https://www.onetonline.org/find?q=#{CGI.escape(focus.occupation_name)}",
          "2. Skim live job postings for \"#{focus.occupation_name}\" to see what employers near you actually require.",
          "3. Compare training programs — #{focus.occupation_name} typically needs #{focus.education_level || 'some postsecondary training'}, around #{money(focus.education_cost)}."
        ]
        if skills.any?
          steps.insert(2, "3. Go deeper on the skills you keep gravitating toward — e.g. #{skills.first(2).to_sentence.downcase}.")
        end
        reply = "Since you liked #{focus.occupation_name}, here's a practical checklist:\n\n#{steps.join("\n")}"
      else
        reply = "Here's how to get momentum:\n\n" \
                "1. Swipe through Discover so I can learn what you value.\n" \
                "2. Ask me to explain the ROI of any career that catches your eye.\n" \
                "3. Compare two finalists head-to-head before committing to training.\n" \
                "4. Come back for next steps once you have a couple of likes saved."
      end

      { reply: reply, quick_replies: next_step_quick_replies(focus) }
    end

    # --- shared helpers -----------------------------------------------------

    def liked_swipes
      Swipe.where(user_id: @user_id, direction: "right").where.not(career_id: nil)
    end

    def liked_careers
      @liked_careers ||= CareerRoi.where(id: liked_swipes.select(:career_id)).order(created_at: :desc).to_a
    end

    def recommendation_pool
      CareerRoi.where(area_code: NATIONAL_AREA)
               .where.not(id: liked_swipes.select(:career_id))
               .order(Arel.sql("demand_score DESC NULLS LAST, roi_percentage DESC"))
               .limit(25).to_a
    end

    def liked_themes(likes)
      feedback_counts = Swipe.where(user_id: @user_id, direction: "right")
                             .where.not(feedback: [nil, ""]).group(:feedback).count
      {
        feedback: feedback_counts.max_by { |_, count| count }&.first,
        avg_salary: average(likes.map(&:annual_median_salary)),
        top_skills: top_liked_skills(likes)
      }
    end

    def top_liked_skills(likes)
      counts = Hash.new(0)
      likes.each do |career|
        Array(career.skills).each { |skill| counts[skill.to_s] += 1 }
      end
      counts.sort_by { |skill, count| [-count, skill] }.map(&:first)
    end

    def reason_for(pick, likes, themes, primary)
      reasons = []
      if themes[:avg_salary] && pick.annual_median_salary.to_f >= themes[:avg_salary]
        reasons << "pays #{money(pick.annual_median_salary)}, above the #{money(themes[:avg_salary])} average of careers you've liked"
      end
      shared = Array(pick.skills).map(&:to_s) & themes[:top_skills]
      reasons << "builds on #{shared.first}, a skill that keeps showing up in your likes" if shared.any?
      reasons << "ranks ##{pick.demand_rank} for national demand" if pick.demand_rank.present? && reasons.size < 2
      reasons << "breaks even on tuition in #{plural_years(pick.years_to_breakeven)}" if reasons.empty?

      if primary && likes.any?
        "#{pick.occupation_name} fits because it #{reasons.join(' and ')}"
      else
        "#{pick.occupation_name}: #{reasons.join(' and ')}"
      end
    end

    def follow_up_quick_replies(picks)
      base = ["What are my next steps?", "Recommend careers for me"]
      base.unshift("Explain ROI for #{singularize_name(picks.first.occupation_name)}") if picks.first
      if picks.size > 1
        base.unshift("Compare #{picks[0].occupation_name} vs #{picks[1].occupation_name}")
      end
      base.first(4)
    end

    def compare_quick_replies(career)
      [
        "Explain ROI for #{singularize_name(career.occupation_name)}",
        "What are my next steps?",
        "Recommend careers for me"
      ]
    end

    def next_step_quick_replies(focus)
      [
        "Recommend careers for me",
        "Explain ROI for #{focus ? singularize_name(focus.occupation_name) : 'registered nurses'}"
      ]
    end

    def side_label(text)
      words = text.to_s.split.reject { |word| STOPWORDS[word] }
      words.empty? ? text.to_s.strip : words.join(" ")
    end

    def terms_from(text)
      tokens = text.to_s.gsub(/[^a-z0-9\s'-]/, " ").split.reject { |token| STOPWORDS[token] }
      terms = []
      tokens.length.downto(1) do |size|
        tokens.each_cons(size) { |chunk| terms << chunk.join(" ") }
      end
      terms.uniq.first(25)
    end

    def find_career_in(text)
      terms_from(text).each do |term|
        career = CareerRoi.where(area_code: NATIONAL_AREA)
                          .where("occupation_name ILIKE ?", "%#{term}%")
                          .order(Arel.sql("demand_score DESC NULLS LAST, LENGTH(occupation_name) ASC"))
                          .first
        return career if career
      end
      nil
    end

    def serialize(careers)
      CareerRoi.where(id: careers.map(&:id)).includes(:career_content)
               .index_by(&:id).values_at(*careers.map(&:id))
               .map { |career| career.as_json.stringify_keys }
    end

    def singularize_name(name)
      name.to_s.singularize.presence || name.to_s
    end

    def money(value)
      "$" + ActiveSupport::NumberHelper.number_to_delimited(value.to_f.round)
    end

    def number(value)
      ActiveSupport::NumberHelper.number_to_rounded(value.to_f, precision: 1).sub(/\.0$/, "")
    end

    def plural_years(years)
      "#{years} #{'year'.pluralize(years.to_i)}"
    end

    def average(values)
      present = values.compact
      return nil if present.empty?
      present.sum(&:to_f) / present.size
    end
  end
end
