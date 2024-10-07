import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Hardcoded lists for now, can later be updated with more values or dynamic sources
years = [2022, 2021, 2020]  # List of years
commodities = [57, 128, 40]  # Example commodity codes (e.g., 57 for gold)


@app.route('/scrape', methods=['GET'])
def scrape_data():
    # Fetching year and commodity from query parameters or defaulting to the first in the list
    year = request.args.get('year', years[0])
    commodity = request.args.get('commodity', commodities[0])

    # URL with the selected year and commodity
    url = f'https://www2.bgs.ac.uk/mineralsUK/data-download/wms.cfc?method=listResults&dataType=Production&commodity={commodity}&dateFrom={year}&dateTo={year}&country=&agreeToTsAndCs=agreed'

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

        return jsonify({
            'status': 'Scraping completed!',
            'year': year,
            'commodity': commodity,
            'data': cleaned_data
        })
    else:
        return jsonify({'status': 'Failed to scrape data', 'error': response.status_code})


if __name__ == '__main__':
    app.run(debug=True)
