title: Scaling with Docker Part 1
tags:
  - docker
  - scaling
  - mesos
  - containers
  - virtual-machines
  - production
  - service-discovery
  - consul
  - consul-template
  - load-balancing
  - ha-proxy
  - medium-scale
  - large-scale
  - images
author: Brandon Okert
date: 2016-01-31 11:03:54
thumbnailImage: thumbnail.png
summary: Getting started with Docker, from a Scaling Perspective
---

This is the first in a two part blog about Scaling with Docker. In Part 1, we'll focus on getting started with Docker from a scaling perspective. For the most part this will be an intro to Docker, so if you're already experienced using mutli-container hosts, docker networks, volume containers, monitoring tools, and management scripts, feel free to skim this part. In Part 2, we'll use the fundamentals from Part 1 to organize scalable multi-host systems, before taking a cursory look at how to take that to very large scale.

# Getting Started with Docker

Rather than telling you what Docker is and why you should use it, I'm going to start by comparing it to Virtual Machines, which are much more familiar. Then we'll jump into the what and how of Docker.

## Docker VS VM's

From a high level perspective, a Container and a Virtual Machine are interchangeable - they both implement a host, or an environment that you can run processes and services within. But the different implementations result in changes in Performance, Organization, and Lifecycle.

### Performance

Let's compare the architecture of Virtual Machines to that of Containers. Click the arrows to cycle through the stages of the diagram.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-1/docker-and-vms/' data-num=7 ></div>

## Docker Ideologies

## Basic Architecture

# Real World Docker

## Connecting Containers

## Persisting Data

## Logging

## Monitoring

# Managing a Host

## Shell Scripts

## Docker Compose
