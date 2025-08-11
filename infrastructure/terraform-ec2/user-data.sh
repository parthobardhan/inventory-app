#!/bin/bash
set -e

yum update -y

amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

curl -fsSL https://rpm.nodesource.com/setup_16.x | bash -
yum install -y nodejs

yum install -y git

mkdir -p /opt/textile-inventory
cd /opt/textile-inventory

git clone https://github.com/parthobardhan/inventory-app.git .

npm install --production

cat > .env << EOF
NODE_ENV=production
PORT=3000
MONGODB_URI=${mongodb_uri}
HUGGINGFACE_API_KEY=${huggingface_api_key}
JWT_SECRET=${jwt_secret}
AWS_REGION=${aws_region}
S3_BUCKET_NAME=${s3_bucket_name}
EOF

cat > /etc/systemd/system/textile-inventory.service << EOF
[Unit]
Description=Textile Inventory Management App
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/textile-inventory
Environment=NODE_ENV=production
EnvironmentFile=/opt/textile-inventory/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

chown -R ec2-user:ec2-user /opt/textile-inventory

systemctl daemon-reload
systemctl enable textile-inventory
systemctl start textile-inventory

yum install -y amazon-cloudwatch-agent

mkdir -p /var/log/textile-inventory
chown ec2-user:ec2-user /var/log/textile-inventory

cat > /etc/logrotate.d/textile-inventory << EOF
/var/log/textile-inventory/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 ec2-user ec2-user
}
EOF

echo "Textile Inventory application setup completed"
