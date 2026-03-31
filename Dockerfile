ARG BUILD_FROM
FROM $BUILD_FROM

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Copy requirements and install
COPY requirements.txt /
RUN pip3 install --no-cache-dir -r /requirements.txt

# Copy the app
COPY . /app
WORKDIR /app

# Expose port
EXPOSE 8099

# Run the app
CMD ["python3", "app.py"]