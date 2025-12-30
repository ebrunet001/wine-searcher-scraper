# Use Apify's Node.js Playwright image with Firefox
FROM apify/actor-node-playwright-firefox:20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --omit=optional \
    && echo "Installed dependencies:" \
    && npm ls --depth=0 \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

# Copy source code
COPY . ./

# Run the Actor
CMD ["npm", "start"]
