#!/bin/bash

# This script runs during building the sandbox template
# and makes sure the Vite app is (1) running and (2) accessible
function ping_server() {
	counter=0
	response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173")
	while [[ ${response} -ne 200 ]]; do
	  let counter++
	  if  (( counter % 20 == 0 )); then
        echo "Waiting for Vite dev server to start..."
        sleep 0.1
      fi

	  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173")
	done
}

# Start the Vite dev server
ping_server &
cd /home/user && npm run dev