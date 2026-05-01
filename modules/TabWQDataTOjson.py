import pandas as pd
import os

from database_accessor_sqlalchemy import *

with open('EStL_WQDashboard.txt', 'r') as fid:
    sql_str = fid.read()
    print (sql_str)

query = dbqISWS() # ESTL_DB
query.sql_query(sql_str)
query.close_connection()

#############aggregate binning###################################
with open('EStL_WQDashboard_year.txt', 'r') as fid:
    sql_str = fid.read()
    print (sql_str)

year = dbqISWS() # ESTL_DB
year.sql_query(sql_str)
year.close_connection()

with open('EStL_WQDashboard_biannual.txt', 'r') as fid:
    sql_str = fid.read()
    print (sql_str)

biannual = dbqISWS() # ESTL_DB
biannual.sql_query(sql_str)
biannual.close_connection()

with open('EStL_WQDashboard_quarter.txt', 'r') as fid:
    sql_str = fid.read()
    print (sql_str)

quarter = dbqISWS() # ESTL_DB
quarter.sql_query(sql_str)
quarter.close_connection()

### ==========================================================
### SAVING CSV AND JSON
### ==========================================================
# Define the target directory and filename
output_directory = '../public/output/'
output_filename = 'EStL_AllDataJoin'


# Ensure the output directory exists (optional, but good practice)
os.makedirs(output_directory, exist_ok=True)

# Create the full path for the output file
output_path_csv = os.path.join(output_directory, output_filename + '.csv')
output_path_json = os.path.join(output_directory, output_filename + '.json')

# Save the DataFrame to CSV in the specified directory
query.data.to_csv(output_path_csv, index=False) # index=False prevents writing the DataFrame index to the CSV
# Save the DataFrame to json in the specified directory
query.data.to_json(output_path_json, index=False) # index=False prevents writing the DataFrame index to the json


############aggregate binning########################
output_path_csv_year = os.path.join(output_directory, output_filename + '_year' + '.csv')
output_path_json_year = os.path.join(output_directory, output_filename + '_year' + '.json')
output_path_csv_biannual = os.path.join(output_directory, output_filename + '_biannual' + '.csv')
output_path_json_biannual = os.path.join(output_directory, output_filename + '_biannual' + '.json')
output_path_csv_quarter = os.path.join(output_directory, output_filename + '_quarter' + '.csv')
output_path_json_quarter = os.path.join(output_directory, output_filename + '_quarter' + '.json')

# Save the DataFrame to CSV in the specified directory
year.data.to_csv(output_path_csv_year, index=False) # index=False prevents writing the DataFrame index to the CSV
# Save the DataFrame to json in the specified directory
year.data.to_json(output_path_json_year, index=False) # index=False prevents writing the DataFrame index to the json
# Save the DataFrame to CSV in the specified directory
biannual.data.to_csv(output_path_csv_biannual, index=False) # index=False prevents writing the DataFrame index to the CSV
# Save the DataFrame to json in the specified directory
biannual.data.to_json(output_path_json_biannual, index=False) # index=False prevents writing the DataFrame index to the json
# Save the DataFrame to CSV in the specified directory
quarter.data.to_csv(output_path_csv_quarter, index=False) # index=False prevents writing the DataFrame index to the CSV
# Save the DataFrame to json in the specified directory
quarter.data.to_json(output_path_json_quarter, index=False) # index=False prevents writing the DataFrame index to the json