import pyodbc

conn = pyodbc.connect(
    r"DRIVER={ODBC Driver 17 for SQL Server};"
    r"SERVER=DESKTOP-0K3GTKB;"
    r"DATABASE=TAS_DB;"
    r"Trusted_Connection=yes;"
)

print("Connected successfully")