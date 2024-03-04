import network
import socket
import time
import struct

from machine import Pin, RTC

NTP_DELTA = 2208988800
# host = "23.150.40.242"
host = "69.89.207.199"

led = Pin("LED", Pin.OUT)

def set_time():
  NTP_QUERY = bytearray(48)
  NTP_QUERY[0] = 0x1B
  addr = socket.getaddrinfo(host, 123)[0][-1]
  print(addr)
  s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
  while True:
    try:
      s.settimeout(1)
      res = s.sendto(NTP_QUERY, addr)
      msg = s.recv(48)
      s.close()
      break
    except OSError as e:
      if e.args[0] == 110:
        time.sleep(2)
        print("Retrying NTP request")
  val = struct.unpack("!I", msg[40:44])[0]
  t = val - NTP_DELTA    
  tm = time.gmtime(t)
  RTC().datetime((tm[0], tm[1], tm[2], tm[6] + 1, tm[3], tm[4], tm[5], 0))
