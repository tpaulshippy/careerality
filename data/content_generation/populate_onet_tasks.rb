# frozen_string_literal: true

require 'json'
require 'csv'
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
      '../../careers/onetsql/db_30_2_text/Task Statements.txt',
      __dir__
    )

    tasks = {}
    CSV.foreach(file_path, col_sep: "\t", headers: true) do |row|
      onet_code = row['O*NET-SOC Code']
      task_id = row['Task ID'].to_i
      task_description = row['Task']
      task_type = row['Task Type']

      key = "#{onet_code}_#{task_id}"
      tasks[key] = {
        onet_code: onet_code,
        task_id: task_id,
        task_description: task_description,
        task_type: task_type
      }
    end

    puts "Loaded #{tasks.size} task statements"
    tasks
  end

  def load_task_ratings
    file_path = File.expand_path(
      '../../careers/onetsql/db_30_2_text/Task Ratings.txt',
      __dir__
    )

    ratings = {} # key: "onet_code_task_id", value: { importance: X, frequency: Y }

    CSV.foreach(file_path, col_sep: "\t", headers: true) do |row|
      onet_code = row['O*NET-SOC Code']
      task_id = row['Task ID'].to_i
      scale_id = row['Scale ID']
      category = row['Category']
      data_value = row['Data Value'].to_f

      # Scale ID: IM = Importance, FT = Frequency
      key = "#{onet_code}_#{task_id}"
      ratings[key] ||= {}

      case scale_id
      when 'IM'
        # Take the average importance across categories
        ratings[key][:importance] = data_value if ratings[key][:importance].nil? || category == '1'
      when 'FT'
        # Take the average frequency across categories
        ratings[key][:frequency] = data_value if ratings[key][:frequency].nil? || category == '1'
      end
    end

    puts "Loaded #{ratings.size} task ratings"
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

    inserted = 0
    skipped = 0

    task_statements.each do |key, statement|
      rating = task_ratings[key] || {}

      # Only insert if the occupation exists in career_profiles
      onet_code = statement[:onet_code]
      exists = ActiveRecord::Base.connection.exec_query(
        "SELECT 1 FROM career_profiles WHERE occupation_code = $1 LIMIT 1",
        nil,
        [onet_code]
      ).any?

      unless exists
        skipped += 1
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
            statement[:onet_code],
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

      puts "Inserted #{inserted} tasks..." if inserted % 10_000 == 0
    end

    puts "\n=== Populate Tasks Summary ==="
    puts "Total task statements processed: #{task_statements.size}"
    puts "Tasks inserted: #{inserted}"
    puts "Tasks skipped (occupation not in DB): #{skipped}"
    puts "Total in database now: #{ActiveRecord::Base.connection.exec_query('SELECT COUNT(*) as count FROM onet_tasks').first['count']}"
  end
end

if __FILE__ == $PROGRAM_NAME
  populator = PopulateOnetTasks.new
  populator.populate_tasks
end
