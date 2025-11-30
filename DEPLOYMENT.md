# Deployment Guide

This guide covers deploying Netflix Auto-Confirm to AWS Lightsail or EC2 t2.micro.

## Prerequisites

- AWS account
- Docker installed on your server
- Your `.env` file with credentials

## Option 1: AWS Lightsail (Recommended for Simplicity)

### Step 1: Create Lightsail Instance

1. Go to AWS Lightsail Console
2. Click "Create instance"
3. Choose:
   - **Platform**: Linux/Unix
   - **Blueprint**: Ubuntu 22.04 LTS
   - **Instance plan**: $3.50/month (512 MB RAM, 1 vCPU) - sufficient for this app
4. Click "Create instance"

### Step 2: Connect to Instance

```bash
# Use Lightsail browser-based SSH or connect via SSH key
ssh ubuntu@your-instance-ip
```

### Step 3: Install Docker 

```bash
# Update system
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Step 4: Deploy Application

```bash
# Clone or upload your project
cd ~
# Upload your project files (use scp, git, or Lightsail file browser)

# Navigate to project directory
cd netflix-auto-confirm

# Create .env file with your credentials
nano .env
# Paste your environment variables

# Build and start the container
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### Step 5: Set Up Auto-Start (Optional)

Create a systemd service for automatic startup:

```bash
sudo nano /etc/systemd/system/netflix-auto-confirm.service
```

Add:
```ini
[Unit]
Description=Netflix Auto-Confirm
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/netflix-auto-confirm
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable netflix-auto-confirm.service
sudo systemctl start netflix-auto-confirm.service
```

## Option 2: AWS EC2 t2.micro (Free Tier Eligible)

### Step 1: Launch EC2 Instance

1. Go to EC2 Console → Launch Instance
2. Choose:
   - **AMI**: Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance type**: t2.micro (Free tier eligible)
   - **Key pair**: Create or select existing
   - **Security group**: Allow SSH (port 22) from your IP
3. Launch instance

### Step 2: Connect to Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### Step 3: Install Docker

Same as Lightsail Step 3 above.

### Step 4: Deploy Application

Same as Lightsail Step 4 above.

### Step 5: Set Up Auto-Start

Same as Lightsail Step 5 above.

## Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

### Restart Application

```bash
docker-compose restart
```

### Update Application

```bash
# Pull latest code
git pull  # or upload new files

# Rebuild and restart
docker-compose up -d --build
```

### Check Container Status

```bash
docker-compose ps
docker stats
```

## Resource Usage

Expected resource usage on t2.micro/Lightsail:
- **CPU**: Low (mostly idle, spikes during email processing)
- **Memory**: ~200-400 MB (Playwright + Node.js)
- **Disk**: ~2-3 GB (Docker image + dependencies)
- **Network**: Minimal (IMAP + occasional browser automation)

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Check Docker status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker
```

### Out of memory

If you see OOM errors:
- Upgrade to t3.micro (1 GB RAM) or Lightsail $5 plan
- Or optimize by using a lighter base image (more complex)

### IMAP connection issues

```bash
# Test IMAP connection from server
telnet imap.gmail.com 993

# Check firewall rules
sudo ufw status
```

### Storage state not persisting

Ensure the volume mount in `compose.yml` is correct:
```yaml
volumes:
  - ./tmp:/app/tmp
```

## Cost Estimate

- **Lightsail $3.50/month**: 512 MB RAM, 1 vCPU, 20 GB SSD
- **EC2 t2.micro**: Free tier (750 hours/month) or ~$7-8/month
- **Data transfer**: Minimal (included in most plans)

## Security Notes

1. Keep your `.env` file secure (never commit to git)
2. Use AWS Secrets Manager for production (optional)
3. Regularly update Docker images: `docker-compose pull`
4. Monitor logs for suspicious activity

## Next Steps

1. Set up CloudWatch alarms (optional)
2. Configure automated backups of storage state
3. Set up email notifications for failures (optional)

