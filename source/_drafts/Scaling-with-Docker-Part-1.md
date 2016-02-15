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
date: 2016-02-16 8:00:00
thumbnailImage: thumbnail.png
summary: Getting started with Docker, from a Scaling Perspective
---

This is the first in a two part post about Scaling with Docker. In Part 1, we'll focus on getting started with Docker from a scaling perspective. For the most part this will be an intro to Docker, so if you're already experienced using mutli-container hosts, docker networks, volume containers, monitoring tools, and management scripts, feel free to skim this part. In Part 2, we'll use the fundamentals from Part 1 to organize scalable multi-host systems, then show where to start to take that to very large scale applications.

# Getting Started

Rather than telling you what Docker is and why you should use it, I'm going to start by comparing Docker to Virtual Machines, which are much more familiar. Then we'll jump into the what and how of Docker.

## Docker VS VM's

From a system architecture perspective, a Container and a Virtual Machine are interchangeable - they both implement a host, or an environment that you can run processes and services within. However, the different implementations result in different Performance and Lifecycles.

### Performance

Let's compare the architecture of Virtual Machines to that of Containers. Click the arrows to cycle through the stages of the diagram.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-1/docker-and-vms/' >
<p>On the left is a VM Host, on the right, a Container Host.</p>
<p>Both have an underlying operating system.</p>
<p>Both have common libraries and programs available.</p>
<p>Both need a Manager of their guests - Hypervisor for VM's and Docker Engine for Docker.</p>
<p>Since Virtual Machines are meant to be their namesake, they need their own Guest Operating System.</p>
<p>They also need the base libraries for the operating system - likely a huge overlap with what's already on the Host.</p>
<p>Finally, both have the actual application code to run. This includes any dependencies or other libraries installed.</p>
</div>

As you can see, Docker containers tend to be much smaller than equivalent VM's, and slightly faster due to being closer to the host operating system. Under the hood, containers use linux [namespaces](http://man7.org/linux/man-pages/man7/namespaces.7.html) and [cgroups](https://en.wikipedia.org/wiki/Cgroups) rather than virtual environments, thus removing a layer of abstraction.

### Lifecycle

A VM is normally created at one point, then maintained via regular provisioning and deployment of services. You place new applications onto the existing box when it's time to update, and log in to the box to monitor, maintain, and debug it.

Containers have a very different lifecycle. Containers are not provisioned; instead you build images that contain your application and configuration, then "deploy" these images as container instances. If there are application or configuration changes, you build a new image, destroy your old containers, and create new ones with the new image.
 
Thus where VM's typically live for a long time, changing throughout their life, containers are meant to be relatively short lived. This encourages the prevailing trend of keeping containers small, and helps avoid snowflakes (servers that have diverged from their provisioned state).

## Docker Components at Scale

We'll talk about the _how_ of scaling in Part 2, and dive into the architecture of Docker in the next section. But as a quick overview, these are the main actors in a scaled docker deployment:

* Containers - Comparable to VM's, these are the basic building blocks of docker deployments, making up our services.
* Docker Hosts - Containers need somewhere to live, and that somewhere is Docker Hosts. These are linux machines that run one or more containers.
* Clusters - A group of Docker Hosts make a cluster. The term cluster is also used synonymously with the tools used to maintain them.





# Docker Architecture

Docker systems are made up of a main tool called the Docker Engine, a collection of tools called the Docker Toolbox, and several container related components. You can [install the toolbox for osx and windows](https://www.docker.com/products/docker-toolbox), or [just the Docker Engine package](https://docs.docker.com/engine/installation/linux/) on a linux based system.

In this section we'll go over these [Tools](#Tools) and [Components](#Components) and where they fit, before touching on the prevailing [Docker Ideologies](#Docker_Ideologies).

## Components

### Containers

Containers have already been introduced - they are the basic building blocks of docker deployments. Containers can be created, destroyed, run, stopped, restarted, and logged into (though the latter is usually avoided). See the [Dockerfiles](#Dockerfiles) section for more info.

Though they are architecturally used like a VM, their implementation is closer to a directory. [Linux Namespaces](http://man7.org/linux/man-pages/man7/namespaces.7.html) and [cgroups](https://en.wikipedia.org/wiki/Cgroups) provide the isolation and limitation to these "directories" that allow them to act like VM's.

### Images

Images are like templates or blueprints for creating containers. After you've built an image using a [Dockerfile](#Dockerfiles), put that image in a [Registry](#Registry), and downloaded it, you can keep using it to create any number of containers. See the [Dockerfiles](#Dockerfiles) section for more info.

Images are made of a series of layers that have a similar function to commits in git. Under the hood, they use a [Union Filesystem](https://en.wikipedia.org/wiki/UnionFS) to iteratively build up the filesystems that become your containers.

### Dockerfiles

Dockerfiles specify how to build [Images](#Images). As a Dockerfile (and the underlying application) evolves, so does the resulting image. A Dockerfile is a series of commands specifying a starting point for your containers, and the libraries, dependencies, and configuration your image needs to run.

Dockerfiles are only concerned with single images - they may specify open ports, but they do not specify other container types or networks to connect to. That is done with [Docker Engine](#Docker_Engine).

Each command in a Dockerfile creates a new layer, or commit. This is similar to how git creates a commit, recording the differential from the last commit. A complete image is a series of commits starting from a base.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-1/images-and-dockerfiles/' >
<p>On the right is our Dockerfile. On the left, the image made from it.</p>
<p>The first command is always a FROM command. You specify a base image here to get a default set of libraries and configuration, for a specific platform. You can also specify scratch as a base image, meaning that no files and configuration will be installed.</p>
<p>The next commands are to setup the dependencies of your runtime. This is no different from the steps you'd run in a provisioner, like Ansible. You might also get some of your dependencies from the base image itself. There's a java:8 base image for example, as well as a consul one.</p>
<p>Next you install your app itself, as well as any local configuration. This is the deploy artifact you generate via your build tools.</p>
<p>After this, you can do any container specific setup. Open ports, setup environment variables, mount volumes, anything. Ideally you'll keep the number of commands to a minimum, as each command creates a new layer in your image.</p>
<p>Once you've created, pushed up, and pulled down an image, you can create a container via the docker run command. The path to init script would have been copied over when you installed the application artifact.</p>
</div>

### Docker Hosts

Containers cannot live in isolation - they are run on hosts. A Docker Host is just a linux machine (virtual or otherwise) that is running Docker Engine.

For small deployments, Docker Hosts are managed manually. For larger deployments, they are abstracted into clusters and managed piecemeal.

Docker Hosts are easy to understand if you convert a VM server into a Docker Host.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-1/converting-to-docker/' >
<p>On the left is a typical server, perhaps on a VM. It's running a web service and database daemon, and storing data in some directory.</p>
<p>First we install Docker Engine, thus converting our Host on the right into a Docker Host.</p>
<p>Then we convert each of the processes on the left into Containers. This is a common theme - typically we want one main process per container.</p>
<p>Our data comes over as a Volume. This is functionally the same as before, but now the volume lives on the Host, and is mounted into each Container. This enables the data to persist beyond the life of a container, and enables sharing of data. This can be done in a read only fashion.</p>
<p>Architecturally these hosts are nearly identical, thus we call the one on the right a Docker Host.</p>
</div>

### Volumes

Volumes are the persistent storage solution for Docker. They are used heavily to ensure data persists after a container is destroyed - you may destroy and rebuild your database container many times a day, but you don't want to destroy the actual data. By putting the data in a volume, then mounting the volume into your container, the data is persisted between iterations of the container.

Volumes can also enable sharing of data, in the case of configuration for example. You can mount them read only to ensure data is only mutated by an administrator.

A common pattern with Volumes is to create Volume Containers. A Volume Container is just a container who's sole purpose is to mount one or more volumes. You can then instruct other containers to mount all volumes mounted by the Volume Container, thus making it easy to modify groups of volumes across several servers. In addition, Volume Containers make it harder to accidentally delete volumes, since the docker daemon won't allow you to delete a volume if at least one container is using it. Volume Containers have no mutating functionality, and thus should not need to be destroyed very often.

For example, you might mount <code>/var/data/service</code>, <code>/var/log/service</code>, and <code>/var/etc/service</code> to a Volume Container. Then you can simply tell your database container to mount any volume in your Volume Container.

### Networks

If you're familiar with older iterations of Docker, you may still not be familiar with Docker Networks. Docker Networks are dockers modern solution to connecting multiple containers in a private network. Previously you had to open ports manually and connect containers, or use docker links to inject the ip address and ports of containers into others via environment variables. It was not fun to maintain, even on small scale projects.
 
With networks, this process is much easier. You create networks independent from containers, specifying a global name to refer to them. Then you just tell docker containers to join them when they're created.

In Docker 1.9, this would cause the hostname and ip of all containers on a network to be injected into each containers hosts file. Thus you could easily communicate between containers by name.

Docker 1.10 improves upon this by providing a full local dns system for your containers. Docker Engine runs a dns server, which is the first server all containers will go to for addresses, and this server contains the other containers on the network. If a host is not found on this server, the request is forward to the next highest dns server, as expected with dns. This is a huge improvement over the hosts file solution, as it plays nicely with other name resolution techniques that we'll see in Part 2.

Networks are a surprisingly big topic in Docker (considering they didn't exist until 1.9), but we'll be making use of them in Part 2. 

## Tools

### Docker Engine

When most people think of Docker, Docker Engine is what they're really referring to. This is the _docker daemon_, the tool-set responsible for running containers. Because docker depends on [namespaces](http://man7.org/linux/man-pages/man7/namespaces.7.html) and [cgroups](https://en.wikipedia.org/wiki/Cgroups) (and other linux kernel features), it is always installed on a linux kernel system. This system is usually called a Docker Host.

Technically you don't interact with the daemon itself; you interact with the docker binary client, who relays commands to the daemon. However, the two are typically used interchangeably.

If you have an actual VM or box running linux, Docker Engine is all you need to get started. If you're running docker on osx or windows, you'll need a linux VM to run Docker Engine.

### Docker Toolbox

Docker toolbox include a fairly large number of tools, most of which can be used regardless of your environment.

I'll only go over the ones you're likely to see often here. You can check out the whole catalogue [here](https://www.docker.com/products/docker-toolbox).

#### Docker Machine

Docker Machine is your docker host management agent. Its sole purpose is to manage docker host VM's on non-linux environments. Like [Vagrant](https://www.vagrantup.com/), it is basically a UI on top of a Virtual Machine manager like [Virtualbox](https://www.virtualbox.org/). It provides many commands for managing docker hosts, and can even setup proxies from your terminal to a specific docker host so that you can interact directly with Docker Engine without having to ssh into the host itself.

Docker Machine is powerful; you can simulate complex production-like multi-host docker deployments on a single laptop (if you have the RAM for it). This makes it possible to have an entirely local staging environment on your development machine to test with.

#### Docker Registry

Once you've built images, you need a place to put them. For a while, Docker Hub will be that place. Docker Hub is just like Git Hub, but instead of storing projects, you're storing images. The similarities don't stop there - images are actually made up of a series of commits, like Git Hub projects. But more on that later.

Docker Registry is the server system that runs repositories like Docker Hub. It's typically used by organizations so that they can store their images privately, and without uploading them to Docker Hub (which often takes a while). You can also setup local registries for personal use, though I won't dig into this much further.

#### Docker Compose

Docker Compose is docker's multi-container deployment scripting solution. It's similar to a [Vagrant File](https://www.vagrantup.com/docs/vagrantfile/) or [Ansible Playbook](http://docs.ansible.com/ansible/playbooks.html), but for multiple containers.

Throughout both parts of this tutorial, I will be using vanilla Bash scripts instead of Docker Compose, as they give a clear and un-adulterated view into what's going on, and give you a lot of control. After you understand what's going on though, feel free to experiment replacing your scripts with compose files.
 
I've historically avoided using Docker Compose due to technical limitations. However, Docker 1.10 has made significant improvements to compose files, which may mean they're ready for production. 

#### Docker Swarm

Docker Swarm is dockers home brewed solution to multi host deployments, orchestration, and scheduling. I'll cover these terms thoroughly in Part 2, but the gist is that we need a tool to monitor the state of our containers and hosts, and "schedule" containers to be placed on our hosts.

Docker Swarm is a double edged sword. On the one hand, it's directly supported by Docker, and thus using it is rather easy; setting up a docker deployment with swarm is fairly quick. On the other hand, Docker Swarm is not nearly as powerful as its main competitors, Mesos and Kubernetes, and is typically not considered ready for large scale production use. Of course, the cost of setting up Mesos or Kubernetes is significantly higher, hence the double edge. [This is a great article](http://radar.oreilly.com/2015/10/swarm-v-fleet-v-kubernetes-v-mesos.html) comparing the most popular Container Orchestration tools.

In part two, I'll be using Mesos at a high level to describe large scale deployments. However, most of the concepts will apply to any Docker Orchestration system, so if you're attached to Swarm, don't fret. It's improving rapidly, and is probably good for all but the largest projects.

## Docker Ideologies

Docker is rather unbiased in how it allows you to use it, giving you significant freedom. That said, there are several principles that are typically desirable that will guide how you set up containers.

* Keep containers small and cheap - this plays into the implementation details, but ideally your containers are very small, and thus easy to trash and re-create.
* One process per container - This is a good general rule for all containers. Later on we'll see that this is not a hard and fast rule, but in general you want containers to have one main purpose, even if there are other smaller processes (eg. syslog) supporting it.
* Trash and rebuild, not fix and restart - This is another rule that we'll find some exceptions to in the practical world, but ideally we treat containers like white boxes - if they've failed, throw it away and start some new ones.
* Store data in volumes, not containers - [Volumes](#Volumes), as discussed above, are directories that live on the Host and are mounted into containers. They separate the data from the container itself, and allow it to persist beyond the container lifecycle, and even be shared by containers (eg. read only configuration). Almost all data you care about should be stored in volumes, including logs, configuration, user data, and interesting output. 
* Don't connect to containers directly - This is related to the above; you want to have access to everything you need in a container without having to connect to it directly, as this doesn't scale well and is difficult in several situations. Ideally we won't be running an ssh server on our container, and everything we'd want to see, like logs, should be exposed via volumes.
* Open as few ports as possible - While it may seem necessary to open ports for every application you want to connect to on your container, most of the time this is not true. Connecting containers with Docker Networks allows containers to intercommunicate, and if you are exposing the right data in volumes, you should have little need to open any ports. A common exception is a debug port for your database service, but even this can be replaced by a debug container that is connected to the docker network.





# Real World Docker

This last section will go over some of the common hurdles that you will undertake with any docker setup.

## Persisting Data

As briefly touched upon above, Volumes and Volume Containers can be used to persist data. Docker will never delete a volume unless you tell it to, and it still won't do it if at least one container is using that volume. But it's still a common enough operation (primarily in dev environments) that it's good to have a handle on protecting your data in the long term.

The best defense, aside from limiting unauthorized access to your Docker Hosts, is Volume Containers. First create your volume(s), either manually via the docker daemon, or automatically in the next step. Then create a volume container that mounts those volumes, and does nothing else. Then never touch this container again. This dangling reference to each volume will make sure that your volumes cannot be accidentally destroyed.

If you do delete the last container that mounts your data, your data is still there (unless you manually told docker to delete it). List your volumes via <code>docker volume ls</code>, then use the printed name to re-mount it in a new Volume Container.

To backup your data, you can use docker inspect on your docker host to find the path of a volume on the host, then back that up. Or, you can deploy a new Backup Container that mounts the volume, compresses the data on it, and backs it up however you see fit.

Any data not in a volume will NOT be persisted. If your Docker Host crashes, containers should enter the stopped state, where the data is probably recoverable. This process is not guaranteed however, so it's best to always put data in volumes.

## Logging

There are two degrees of logging that you'll be interested in with docker.

The first is your services logs - these are often at the debug level, and help you determine at fine detail what your services are doing or how/why they failed. They are typically too large to store long term; in traditional VM systems they are stored on the VM itself, and rotated regularly. With docker, these logs can be treated in a similar fashion, except they should be stored in a volume created by the container running them (or to make all instances of a service log in one place, use a shared volume from a volume container). The logs will remain available even if the container dies, and can be rotated as normal.

The second type of log are your event logs. These are higher level logs that typically are kept for much longer. For large systems, you'll want to store these somewhere like logstash to be easily shared and queried, since events are usually independent of the underlying scaling mechanism. These logstash servers can themselves be containers on your docker network, storing their data in volumes provided by a logstash Volume Container.

Either type of log may require a system like syslog running on your container. This is a common example of a reasonable exception to the one process per container rule.

## Monitoring

While after the fact observation is done with event logs, real time monitoring is not a simple ordeal. In Part 2, I'll show a couple ways it can be used, typically in combination with your Service Discovery or Container Orchestration/Scheduling infrastructure.

For manual inspections, the docker daemon provides several command line utilities to peer into containers. For automated solutions, you'll typically have another sub process on your containers that monitors it (a consul agent, mesos daemon, nagios daemon, sensu agent, and so on). This is the second common exception to the one process per container rule.

There are also several commercial solutions built specifically for docker, easily found by searching for "Docker Monitoring". However, I recommend integrating your monitoring into one of your other pieces of infrastructure, to reduce boilerplate and maintenance. Using a technology that helps you scale to do your monitoring will help ensure your monitoring is also scalable.





# Conclusion

I hope this has been an illustrative introduction to the various pieces that make up Docker. Surely there's more to be said, but this should be enough for us to confidently get our hands dirty in Part 2, where we'll use what we've learned as building blocks to build a scalable Docker Service.
