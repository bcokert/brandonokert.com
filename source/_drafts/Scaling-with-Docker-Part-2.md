title: Scaling with Docker Part 2
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
date: 2016-02-04 18:33:10
thumbnailImage: thumbnail.png
summary: Scaling Docker with Examples
---

This is the second in a two part blog about Scaling with Docker. In this part, we'll take what we learned in Part 1 and use it to create scalable and resilient services with Docker. While the previous part took a more conceptual route, this part will feature more practical examples. We'll build stacks capable of handling several Docker Hosts and hundreds of containers, identify the weaknesses of individually maintained hosts, and give an overview of how to solve them with Mesos. 

<!-- toc -->

# The Docker Monolith

# Deeper Into Docker

## One Process to Rule Them All

## Process Management

# Scaling Docker Services

## Horizontally Scaling

## Load Balancing

## Service Discovery

## DNS Basics

# Large Scale Docker

## Problems With Current Solution

## General Strategy - The DCOS

# Mesos

## Abstraction of Docker Hosts

## Scheduling Containers
