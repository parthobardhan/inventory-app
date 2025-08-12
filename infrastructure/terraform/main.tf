terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default_public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  
  filter {
    name   = "map-public-ip-on-launch"
    values = ["true"]
  }
}

data "aws_subnet" "selected_subnets" {
  count = min(2, length(data.aws_subnets.default_public.ids))
  id    = data.aws_subnets.default_public.ids[count.index]
}

resource "aws_security_group" "alb" {
  name_prefix = "textile-inventory-alb-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "textile-inventory-alb-sg"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "textile-inventory-ecs-tasks-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name      = "textile-inventory-ecs-tasks-sg"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_lb" "main" {
  name               = "textile-inventory-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = slice(data.aws_subnets.default_public.ids, 0, 2)

  enable_deletion_protection = false

  tags = {
    Name      = "textile-inventory-alb"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_lb_target_group" "app" {
  name        = "textile-inventory-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = {
    Name      = "textile-inventory-tg"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

data "aws_ecr_repository" "app" {
  name = "textile-inventory-app"
}

resource "aws_ecs_cluster" "main" {
  name = "textile-inventory-cluster"

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = aws_cloudwatch_log_group.ecs.name
      }
    }
  }

  tags = {
    Name      = "textile-inventory-cluster"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/textile-inventory"
  retention_in_days = 30

  tags = {
    Name      = "textile-inventory-logs"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "textile-inventory-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "textile-inventory-app"
      image = "${data.aws_ecr_repository.app.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = "3000"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name  = "S3_BUCKET_NAME"
          value = var.s3_bucket_name
        }
      ]

      secrets = [
        {
          name      = "MONGODB_URI"
          valueFrom = aws_secretsmanager_secret.mongodb_uri.arn
        },
        {
          name      = "HUGGINGFACE_API_KEY"
          valueFrom = aws_secretsmanager_secret.huggingface_api_key.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = {
    Name      = "textile-inventory-task"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_ecs_service" "app" {
  name            = "textile-inventory-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = slice(data.aws_subnets.default_public.ids, 0, 2)
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "textile-inventory-app"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.app]

  tags = {
    Name      = "textile-inventory-service"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "textile-inventory-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name      = "textile-inventory-ecs-task-execution-role"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_iam_role" "ecs_task_role" {
  name = "textile-inventory-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name      = "textile-inventory-ecs-task-role"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets_policy" {
  name = "textile-inventory-ecs-secrets-policy"
  role = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.mongodb_uri.arn,
          aws_secretsmanager_secret.huggingface_api_key.arn,
          aws_secretsmanager_secret.jwt_secret.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3_policy" {
  name = "textile-inventory-ecs-s3-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.s3_bucket_name}"
      }
    ]
  })
}

resource "aws_secretsmanager_secret" "mongodb_uri" {
  name        = "textile-inventory/mongodb-uri"
  description = "MongoDB Atlas connection string for textile inventory app"

  tags = {
    Name      = "textile-inventory-mongodb-uri"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_secretsmanager_secret_version" "mongodb_uri" {
  secret_id     = aws_secretsmanager_secret.mongodb_uri.id
  secret_string = var.mongodb_uri
}

resource "aws_secretsmanager_secret" "huggingface_api_key" {
  name        = "textile-inventory/huggingface-api-key"
  description = "Hugging Face API key for AI image captioning"

  tags = {
    Name      = "textile-inventory-huggingface-api-key"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_secretsmanager_secret_version" "huggingface_api_key" {
  secret_id     = aws_secretsmanager_secret.huggingface_api_key.id
  secret_string = var.huggingface_api_key
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "textile-inventory/jwt-secret"
  description = "JWT secret for textile inventory app"

  tags = {
    Name      = "textile-inventory-jwt-secret"
    owner     = "partho.bardhan"
    purpose   = "training"
    expire-on = "2025-09-15"
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}
