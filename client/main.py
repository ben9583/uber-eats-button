import machine
import network
import time
import urequests as requests
import usocket as socket

from timesync import set_time
from ujwt.jwt import Jwt
from uuid import uuid4

ap_ssid = "UberEatsButton"
ap_password = "sneakybutton"

server_name = "Fluffy HTTP Server :3 (MicroPython/1.22.2, Raspberry Pi Pico W)"
dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] 
is_ap = False

with open('./ssid.txt', 'r') as f:
  ssid_stored = f.read()

with open('./password.txt', 'r') as f:
  password_stored = f.read()

with open('./secret.txt', 'r') as f:
  secret = f.read()

jwt_gen = Jwt(secret)
wlan = network.WLAN()

def error_400() -> bytes:
  response = f"HTTP/1.1 400 Bad Request\r\nServer: {server_name}\r\nContent-Type: text/plain;charset=utf-8\r\nConnection: close\r\nContent-Length: 11\r\n\r\nBad Request"

  return response.encode('utf-8')

def error_404() -> bytes:
  response = f"HTTP/1.1 404 Not Found\r\nServer: {server_name}\r\nContent-Type: text/plain;charset=utf-8\r\nConnection: close\r\nContent-Length: 9\r\n\r\nNot Found"

  return response.encode('utf-8')

def success_200() -> bytes:
  response = f"HTTP/1.1 200 OK\r\nServer: {server_name}\r\nContent-Type: text/plain;charset=utf-8\r\nConnection: close\r\nContent-Length: 2\r\n\r\nOK"

  return response.encode('utf-8')

def web_page(req: bytes) -> bytes:
  html = "<!DOCTYPE html><html><body><p>Unable to load the page</p></body</html>"
  with open('index.html', 'r') as f:
    html = f.read()

  response = f"HTTP/1.1 200 OK\r\nLocation: /\r\nAllow: GET\r\nServer: {server_name}\r\nContent-Type: text/html;charset=utf-8\r\nContent-Language: en-US\r\nConnection: close\r\nContent-Length: {len(html)}\r\n\r\n{html}"
  
  return response.encode('utf-8')

def connect_page(req: bytes) -> bytes:
  html = "<!DOCTYPE html><html><body><p>Unable to load the page</p></body</html>"
  with open('connect.html', 'r') as f:
    html = f.read()

  response = f"HTTP/1.1 200 OK\r\nLocation: /\r\nAllow: GET\r\nServer: {server_name}\r\nContent-Type: text/html;charset=utf-8\r\nContent-Language: en-US\r\nConnection: close\r\nContent-Length: {len(html)}\r\n\r\n{html}"
  
  return response.encode('utf-8')

def load_pico_css(conn: socket.socket) -> None:
  # Special case for pico.min.css because it's too big to all fit in memory, so we have to read it in chunks
  response = f"HTTP/1.1 200 OK\r\nLocation: /pico.min.css\r\nAllow: GET\r\nServer: {server_name}\r\nContent-Type: text/css;charset=utf-8\r\nContent-Length: 82187\r\n\r\n"
  conn.write(response.encode('utf-8'))

  with open('pico.min.css', 'r') as f:
    while True:
      data = f.read(4096)
      if not data:
        break

      conn.write(data.encode('utf-8'))

  conn.close()

def post_connect(req: bytes) -> bool:
  parts = req.split(b"\r\n\r\n")
  if len(parts) < 2:
    print("Wrong number of parts")
    return False
  
  data = parts[1].decode('utf-8')
  print(data)

  elems = data.split("&")
  if len(elems) < 2:
    print("Invalid data elements")
    return False
  
  ssid_key_value = elems[0].split("=")
  password_key_value = elems[1].split("=")

  if len(ssid_key_value) < 2 or len(password_key_value) < 2:
    print("Invalid data values")
    return False
  
  ssid = ssid_key_value[1].replace("+", " ")
  password = password_key_value[1].replace("+", " ")

  print(f"SSID: {ssid}, Password: {password}")

  with open('ssid.txt', 'w') as f:
    f.write(ssid)

  with open('password.txt', 'w') as f:
    f.write(password)

  global ssid_stored
  global password_stored
  global is_ap
  ssid_stored = ssid
  password_stored = password
  is_ap = False

  return True

# if you do not see the network you may have to power cycle
# unplug your pico w for 10 seconds and plug it in again
def ap_mode() -> None:
  while not wlan.active():
    time.sleep_ms(500)

  print('AP Mode Is Active, You can Now Connect')
  print('IP Address To Connect to:: ' + str(wlan.ifconfig()))

  s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)   #creating socket object
  s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  s.bind(('', 80))
  s.listen()

  while True:
    try:
      conn, addr = s.accept()
      
      print('Got a connection from %s' % str(addr))
      request = conn.recv(4096)
      print('Content = %s' % str(request))

      loc_split = str(request).split(" ")
      if len(loc_split) == 1:
        print("No location")
        continue

      location = loc_split[1]

      response = error_404()
      print('Location = %s' % location)
      print('Method = %s' % request[:max(0, (request.decode("utf-8")).find(" "))].decode("utf-8"))
      if location == "/" and request[:3] == b"GET":
        response = web_page(request)
      elif location == "/test" and request[:3] == b"GET":
        response = success_200()
      elif location == "/pico.min.css" and request[:3] == b"GET":
        load_pico_css(conn)
        continue
      elif location == "/connect" and request[:4] == b"POST":
        success = post_connect(request)
        if success:
          conn.write(connect_page(request))
          time.sleep(2)
          conn.close()
          s.close()
          break
        else:
          conn.write(error_400())
      
      conn.write(response)
    except BaseException as e:
      print('An exception occurred: {}'.format(e))
      print('Shutting Down')
      conn.close()
      s.close()
      raise e

button_pin = machine.Pin(13, machine.Pin.IN, machine.Pin.PULL_UP)
led_pin = machine.Pin(15, machine.Pin.OUT)
def sta_mode() -> None:
  num_tries = 0
  debounce = True
  first_connection = True

  while True:
    if not wlan.isconnected():
      if num_tries >= 10:
        print('Failed to connect to network after 10 tries, entering AP mode')
        global is_ap
        is_ap = True
        break
      
      num_tries += 1
      print(f'Failed to connect to network, trying again ({num_tries}/10)...')
      time.sleep_ms(int(100 * (1.5 ** num_tries)))
      continue
    elif first_connection:
      print('Connected to Network')
      led_pin.value(1)
      time.sleep(3)

      print("Config: " + str(wlan.ifconfig()))
      print("Old time: " + str(time.gmtime()))
      set_time()
      print("New time: " + str(time.gmtime()))
      led_pin.value(0)
      first_connection = False

    num_tries = 0
    time.sleep_ms(50)

    if button_pin.value() == 0 and debounce:
      debounce = False
      print("Button Pressed")
      led_pin.value(1)
      try:
        # http://ec2-54-202-136-67.us-west-2.compute.amazonaws.com/order
        # https://raspi.ben9583.com/order
        # http://duststorm.ocf.berkeley.edu/order
        requests.put('http://duststorm.ocf.berkeley.edu/order', headers={'Authorization': 'Bearer ' + jwt_gen.encode({
          "sub": "random-order",
          "iss": "uber-eats-client.ben9583.com",
          "aud": "uber-eats-server.ben9583.com",
          "jti": uuid4().hex,
          "iat": time.time() * 1000,
          "exp": (time.time() + 60) * 1000
        })})
      except BaseException as e:
        print("Request failed")
        print(e)
        led_pin.value(0)
        machine.soft_reset()
    elif button_pin.value() == 1:
      debounce = True
      led_pin.value(0)
      

while True:
  wlan = network.WLAN(network.STA_IF)
  wlan.active(True)
  wlan.connect(ssid_stored, password_stored)

  if is_ap:
    ap_mode()
  else:
    sta_mode()
  