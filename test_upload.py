import urllib.request
import json

url = 'http://localhost:8000/async/extract'
headers = {
    'Authorization': 'Bearer downtown_haven_meal',
    'Content-Type': 'multipart/form-data; boundary=---boundary'
}
body = (
    b'-----boundary\r\n'
    b'Content-Disposition: form-data; name="doc_type"\r\n\r\n'
    b'receipt\r\n'
    b'-----boundary\r\n'
    b'Content-Disposition: form-data; name="model"\r\n\r\n'
    b'llama-3.3-70b-versatile\r\n'
    b'-----boundary\r\n'
    b'Content-Disposition: form-data; name="file"; filename="test.pdf"\r\n'
    b'Content-Type: application/pdf\r\n\r\n'
    b'fake pdf content\r\n'
    b'-----boundary--\r\n'
)

req = urllib.request.Request(url, data=body, headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as response:
        print('Status:', response.status)
        print('Response:', response.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP Error:', e.code, e.read().decode())
except Exception as e:
    print('Error:', e)
