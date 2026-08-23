# Use a highly reliable base image that comes with both Python 3.11 and Node 20 pre-installed
FROM nikolaik/python-nodejs:python3.11-nodejs20

# Set the working directory
WORKDIR /app

# Copy your whole local repository into the cloud machine
COPY . .

# 1. Install Python ML dependencies at the root
RUN pip install -r requirements.txt

# 2. Go into the server folder and install Node dependencies
WORKDIR /app/server
RUN npm install

# Start the server (Railway automatically assigns the PORT variable)
CMD ["node", "server.js"]
