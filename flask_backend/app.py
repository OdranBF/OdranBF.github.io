import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

# Global variables to track the year and commodity
current_year = 2022
commodity = 57  # Default commodity code


@app.route('/scrape', methods=['GET'])
def scrape_data():
    global current_year

    # Construct the URL dynamically based on the year
    url = f'https://www2.bgs.ac.uk/mineralsUK/data-download/wms.cfc?method=listResults&dataType=Production&commodity={commodity}&dateFrom={current_year}&dateTo={current_year}&country=&agreeToTsAndCs=agreed'

    response = requests.get(url)

    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find the table and extract data
        table = soup.find('table')
        rows = table.find_all('tr')

        cleaned_data = {}  # Dictionary to store country and production

        for row in rows[1:]:  # Skip the header row
            columns = row.find_all('td')
            country = columns[0].text.strip()
            production = columns[3].text.strip()

            # Only add if production is not empty
            if production:
                cleaned_data[country] = production

        # Decrease the year by 1, loop back to 2022 if below 1970
        current_year -= 1
        if current_year < 1990:
            current_year = 2022

        return jsonify({'status': 'Scraping completed!', 'data': cleaned_data, 'year': current_year})
    else:
        return jsonify({'status': 'Failed to scrape data', 'error': response.status_code})


if __name__ == '__main__':
    app.run(debug=True)
