FROM node:20

# set the working directory inside of container
WORKDIR /usr/src/app

# copy over the dependencies
COPY package*.json ./

# run the command to install needs
RUN npm install

# Copy over project files
COPY . .

# build final project when complete
# RUN npm run build

# Make port 3000 available to the world outside this container
EXPOSE 3000

# Run the node commands to initiate the dashboard
# CMD ["npm", "run", "start"]
CMD ["npm", "run", "dev"]

# next run in the terminal:
#    > docker build -t <<your_image_name>>
#    > docker run -dp 3000:3000 <<your_image_name>>