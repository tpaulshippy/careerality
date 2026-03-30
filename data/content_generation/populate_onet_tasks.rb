# frozen_string_literal: true

require 'json'
require 'csv'
require 'set'
require 'active_record'

class PopulateOnetTasks
  DB_CONFIG = {
    adapter: ENV.fetch('DB_ADAPTER', 'postgresql'),
    database: ENV['DB_NAME'] || ENV['PGDATABASE'] || 'careerality',
    user: ENV['DB_USER'] || ENV['PGUSER'] || 'postgres',
    password: ENV['DB_PASSWORD'] || ENV['PGPASSWORD'] || 'postgres',
    host: ENV['DB_HOST'] || ENV['PGHOST'] || 'localhost'
  }

  def initialize
    establish_connection
  end

  def establish_connection
    ActiveRecord::Base.establish_connection(DB_CONFIG)
  end

  def load_task_statements
    file_path = File.expand_path(
      '../careers/onetsql/db_30_2_text/Task Statements.txt',
      __dir__
    )

    tasks = {}
    
    # Try standard CSV parsing first
    begin
      CSV.foreach(file_path, col_sep: "\t", headers: true, quote_char: '"', liberal_parsing: true) do |row|
        onet_code = row['O*NET-SOC Code']
        task_id = row['Task ID']&.to_i
        task_description = row['Task']
        task_type = row['Task Type']

        # Skip if critical fields are missing
        next unless onet_code && task_id && task_description

        key = "#{onet_code}_#{task_id}"
        tasks[key] = {
          onet_code: onet_code,
          task_id: task_id,
          task_description: task_description,
          task_type: task_type
        }
      end
    rescue CSV::MalformedCSVError => e
      puts "CSV parsing failed (#{e.message}), switching to lenient mode..."
      tasks = load_task_statements_lenient(file_path)
    end

    puts "Loaded #{tasks.size} task statements"
    tasks
  end

  def load_task_statements_lenient(file_path)
    tasks = {}
    line_num = 0
    headers = nil

    File.readlines(file_path).each do |line|
      line_num += 1
      # Remove carriage returns and normalize line endings
      line = line.chomp.gsub(/\r$/, '')

      # Parse first line as headers
      if line_num == 1
        headers = line.split("\t")
        next
      end

      # Parse data lines by splitting on tabs
      begin
        values = line.split("\t", headers.size)
        row_hash = Hash[headers.zip(values)]

        onet_code = row_hash['O*NET-SOC Code']
        task_id = row_hash['Task ID']&.to_i
        task_description = row_hash['Task']
        task_type = row_hash['Task Type']

        next unless onet_code && task_id && task_description

        key = "#{onet_code}_#{task_id}"
        tasks[key] = {
          onet_code: onet_code,
          task_id: task_id,
          task_description: task_description,
          task_type: task_type
        }
      rescue StandardError => e
        puts "Warning: Skipping line #{line_num}: #{e.message}" if line_num < 10
        next
      end
    end

    puts "Loaded #{tasks.size} task statements (lenient mode)"
    tasks
  end

  def load_task_ratings
    file_path = File.expand_path(
      '../careers/onetsql/db_30_2_text/Task Ratings.txt',
      __dir__
    )

    ratings = {} # key: "onet_code_task_id", value: { importance: X, frequency: Y }

    begin
      CSV.foreach(file_path, col_sep: "\t", headers: true, quote_char: '"', liberal_parsing: true) do |row|
        onet_code = row['O*NET-SOC Code']
        task_id = row['Task ID']&.to_i
        scale_id = row['Scale ID']
        category = row['Category']
        data_value = row['Data Value']&.to_f

        next unless onet_code && task_id && scale_id && data_value

        # Scale ID: IM = Importance, FT = Frequency
        key = "#{onet_code}_#{task_id}"
        ratings[key] ||= {}

        case scale_id
        when 'IM'
          # Take the first/primary importance rating (category 1)
          ratings[key][:importance] = data_value if ratings[key][:importance].nil? || category == '1'
        when 'FT'
          # Take the first/primary frequency rating (category 1)
          ratings[key][:frequency] = data_value if ratings[key][:frequency].nil? || category == '1'
        end
      end
    rescue CSV::MalformedCSVError => e
      puts "CSV parsing failed for ratings (#{e.message}), switching to lenient mode..."
      ratings = load_task_ratings_lenient(file_path)
    end

    puts "Loaded #{ratings.size} task ratings"
    ratings
  end

  def load_task_ratings_lenient(file_path)
    ratings = {}
    line_num = 0
    headers = nil

    File.readlines(file_path).each do |line|
      line_num += 1
      line = line.chomp.gsub(/\r$/, '')

      if line_num == 1
        headers = line.split("\t")
        next
      end

      begin
        values = line.split("\t", headers.size)
        row_hash = Hash[headers.zip(values)]

        onet_code = row_hash['O*NET-SOC Code']
        task_id = row_hash['Task ID']&.to_i
        scale_id = row_hash['Scale ID']
        category = row_hash['Category']
        data_value = row_hash['Data Value']&.to_f

        next unless onet_code && task_id && scale_id && data_value

        key = "#{onet_code}_#{task_id}"
        ratings[key] ||= {}

        case scale_id
        when 'IM'
          ratings[key][:importance] = data_value if ratings[key][:importance].nil? || category == '1'
        when 'FT'
          ratings[key][:frequency] = data_value if ratings[key][:frequency].nil? || category == '1'
        end
      rescue StandardError => e
        puts "Warning: Skipping ratings line #{line_num}: #{e.message}" if line_num < 10
        next
      end
    end

    puts "Loaded #{ratings.size} task ratings (lenient mode)"
    ratings
  end

  def populate_tasks
    task_statements = load_task_statements
    task_ratings = load_task_ratings

    # Get existing tasks to avoid duplicates
    existing_count = ActiveRecord::Base.connection.exec_query(
      "SELECT COUNT(*) as count FROM onet_tasks"
    ).first['count']

    puts "Existing tasks in database: #{existing_count}"

    # Fetch all occupation codes to build a lookup set
    valid_occupation_codes = Set.new(
      ActiveRecord::Base.connection.exec_query(
        "SELECT occupation_code FROM career_profiles"
      ).map { |row| row['occupation_code'] }
    )

    puts "Found #{valid_occupation_codes.size} occupations in database"

    inserted = 0
    skipped = 0
    not_found = 0

    task_statements.each do |key, statement|
      rating = task_ratings[key] || {}
      onet_code = statement[:onet_code]

      # Validate that the O*NET code exists in career_profiles
      unless valid_occupation_codes.include?(onet_code)
        not_found += 1
        next
      end

      begin
        ActiveRecord::Base.connection.exec_insert(
          <<~SQL,
            INSERT INTO onet_tasks (occupation_code, task_id, task_description, importance, frequency, task_type, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (occupation_code, task_id) DO NOTHING
          SQL
          nil,
          [
            onet_code,
            statement[:task_id],
            statement[:task_description],
            rating[:importance],
            rating[:frequency],
            statement[:task_type]
          ]
        )
        inserted += 1
      rescue StandardError => e
        puts "Error inserting task #{key}: #{e.message}"
      end

      puts "Inserted #{inserted} tasks..." if inserted % 5_000 == 0
    end

    puts "\n=== Populate Tasks Summary ==="
    puts "Total task statements processed: #{task_statements.size}"
    puts "Tasks inserted: #{inserted}"
    puts "Tasks not found in DB: #{not_found}"
    puts "Total in database now: #{ActiveRecord::Base.connection.exec_query('SELECT COUNT(*) as count FROM onet_tasks').first['count']}"
  end
end

if __FILE__ == $PROGRAM_NAME
  populator = PopulateOnetTasks.new
  populator.populate_tasks
end
