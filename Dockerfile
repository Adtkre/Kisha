# Use a highly reliable base image that comes with both Python 3.11 and Node 20 pre-installed
FROM nikolaik/python-nodejs:python3.11-nodejs20

# Set the working directory
WORKDIR /app

# Copy your whole local repository into the cloud machine
COPY . .

# 1. Provide dependencies
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

# 2. Go into the backend folder and install Node dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install

# 3. Copy the rest of the backend source code
COPY backend/ ./

# Start the server (Railway automatically assigns the PORT variable)
CMD ["node", "server.js"]
