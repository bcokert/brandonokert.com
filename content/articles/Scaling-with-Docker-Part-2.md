---
author: Brandon Okert
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
description: Scaling Docker with Examples
title: Scaling with Docker Part 2
linktitle: ""
featured: docker-thumb.png
featuredpath: /img/Scaling-With-Docker-Part-2/
featuredalt: ""
date: 2016-03-07
type: post
---

This is the second in a two part blog about Scaling with Docker. In this part, we'll take what we learned in Part 1 and use it to create a scalable and resilient service with Docker. While the previous part took a more conceptual route, this part will focus more on practical applications. At each stage we'll update a set of scripts to automate building and deploying, and go through a few tests to get familiar with the results. Then I'll show you how you can use the same techniques on multiple services, and finally give an overview of how to scale massively, to thousands of hosts.

I've implemented an example project on [github](https://github.com/bcokert/scaling-with-docker-example). As you go through the steps here, I'll let you know when to check out different tags, if you want to follow along with the code.

# Getting Ready

We're going to need a few things to build our first Docker Host. We need a service to work with. We need to install Virtual Box to run our docker hosts. And we'll need Docker itself.

These instructions are written assuming you're using OSX or Linux; the process for Windows is equivalent to that of OSX, though you'll have to translate a few terminal commands.

## Service

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step1</code></p>

If you've already got a service you want to test with, great! If not, I'll be using a toy service in all of my examples, so that it's easy to experiment without managing a complex service. To use your service instead of the toy one, just replace the toy service with yours in the build-scripts and deploy-scripts - I'll point out where you need to do this.

You can test the toy service by going into the src folder and running <code>./start.sh.</code> Then browse to <code>localhost:8080/example1.html</code> to see if it hits our "endpoint". I've made 2 endpoints for your testing pleasure. Later when we develop the build and deploy scripts, we'll "build" it by copying the content of <code>src/</code> to <code>build/</code>.

## Virtual Box

If you're on OSX or Windows, virtual box will be installed for you when you install Docker Toolbox (if you don't already have it). Otherwise, install via your favorite package manager or the [downloads page](https://www.virtualbox.org/wiki/Downloads). Version shouldn't matter, but you don't want one too old. Also, make sure to install the extensions if prompted.

We'll be using Docker Machine to actually create and manage our VM's, so once you're installed, you're good to go.

## Docker and Docker Toolbox

On linux, you can install each package individually. On OSX and Windows, installing Toolbox will install everything you need.

I'm going to leave the installing to the [fine documentation on the docker website](https://docs.docker.com/engine/installation/), as it's pretty comprehensive, and the instructions change from version to version.

# Building a Docker Host

Let's go back to the conversion from a VM to a Docker Host. You've seen this before, but this time we're going to implement it.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-1/converting-to-docker/' >
<p>On the left is a typical server, perhaps on a VM. It's running a web service and database daemon, and storing data in some directory.</p>
<p>First we install Docker Engine, thus converting our Host on the right into a Docker Host.</p>
<p>Then we convert each of the processes on the left into Containers. This is a common theme - typically we want 1 main process per container.</p>
<p>Our data comes over as a Volume. This is functionally the same as before, but now the volume lives on the Host, and is mounted into each Container. This enables the data to persist beyond the life of a container, and enables sharing of data. This can be done in a read only fashion.</p>
<p>Architecturally these hosts are nearly identical, thus we call the one on the right a Docker Host.</p>
</div>

Throughout this post, most of the work will be done with shell scripts. This is to make it maximally transferable, and easy to understand what's going on. If you're already comfortable with tools like Docker Compose, feel free to use those instead.

We'll need a few scripts by the end:

* <code>resources/dockerfiles/dockerfile-X</code> - these will be our dockerfiles, which we'll need one of per image
* <code>resources/dev-scripts/build-X.sh</code> - these will update our docker images when the underlying application or service changes, and push the results up to the registry. We'll need one per image type.
* <code>resources/server-scripts/deploy.sh</code> - this is a server side script, and deploys an entire host. For complex applications, you'd probably split this into a few scripts, but we'll just use one for brevity. This script will deploy ALL of our containers, and it's arguments will determine how we scale.

## Creating a Dockerfile

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step2</code>.</p>

Remember the process of creating an image from a dockerfile?

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-1/images-and-dockerfiles/' >
<p>On the right is our Dockerfile. On the left, the image made from it.</p>
<p>The first command is always a FROM command. You specify a base image here to get a default set of libraries and configuration, for a specific platform. You can also specify scratch as a base image, meaning that no files and configuration will be installed.</p>
<p>The next commands are to setup the dependencies of your runtime. This is no different from the steps you'd run in a provisioner, like Ansible. You might also get some of your dependencies from the base image itself. There's a java:8 base image for example, as well as a consul one.</p>
<p>Next you install your app itself, as well as any local configuration. This is the deploy artifact you generate via your build tools.</p>
<p>After this, you can do any container specific setup. Open ports, setup environment variables, mount volumes, anything. Ideally you'll keep the number of commands to a minimum, as each command creates a new layer in your image.</p>
<p>Once you've created, pushed up, and pulled down an image, you can create a container via the docker run command. The path to init script would have been copied over when you installed the application artifact.</p>
</div>

Our first dockerfile is in <code>resources/dockerfiles/dockerfile-server</code>.

An important note if you're getting started with docker - the Dockerfile doesn't build our application. It only builds our _image_. It assumes we've already build the application by the time we run the dockerfile.

## Creating and Storing Images

We can now create our image. However, this requires we already have a registry setup.
 
Don't want to build the image yourself? You can download a ready to go image from [my dockerhub repo](https://hub.docker.com/r/bcokert/simple-server/). I'll show you how in the next section.

### Registry

If you've got a registry already, feel free to use it. Otherwise, take a minute to go to [dockerhub](https://hub.docker.com/) and setup an account. If you're following along with the code examples, go ahead and [create a repository](https://hub.docker.com/add/repository/) called <code>example-server</code>. Once you've done so, you can login to dockerhub via <code>docker login</code>.

To use my pre-built image instead of building your own just run <code>docker pull bcokert/simple-service</code>.

### Docker Host

For most of this tutorial we'll be using the default machine. There's nothing special about this machine, except that in docker 1.10 and higher if you omit the name in commands, it will automatically look for a machine called "default".

<code>docker-machine create --driver virtualbox default </code>

Once it's done, you can log into it via <code>docker-machine ssh default</code>, and then use your docker commands from there. However, with docker-machine it is common to export some environment variables to enable using docker directly from your terminal.

```
> docker-machine env default
export DOCKER_TLS_VERIFY="1"
export DOCKER_HOST="tcp://192.168.99.100:2376"
export DOCKER_CERT_PATH="/Users/username/.docker/machine/machines/default"
export DOCKER_MACHINE_NAME="default"
```

You run <code>eval "$(docker-machine env default)"</code> in your terminal before using docker. If you run fish terminal (or a more esoteric one), you might need to [pass something special to the --shell option of env](https://docs.docker.com/machine/reference/env/).

### Putting it together

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step3</code>.</p>

Instead of pushing our image up to a repository manually, we're going to go right to automating our build process to make this quicker down the road.

The <code>resources/dev-scripts/build-service.sh</code> script automatically checks that we're logged in to docker hub, makes sure the right docker machine is running and available, creates our image, and pushes it up to our repository for us. If you're following along and have your own repository, use the environment variable <code>DOCKER_REPOSITORY</code> to avoid having to copy paste your repository all over the place.

The key part of the build process is building our actual project - compiling, bundling, minifying, or whatever "building" means for your project. The end result should be a set of artifacts, which we then just copy into our image.

## Testing our Image

Let's give this container a quick test to make sure it's setup properly:

```
> docker run --name simple-server-test ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh</code>
```

When you do this, your terminal will start receiving logs from that container. Kill it with ctrl-C, remove the now stopped container with <code>docker rm simple-server-test</code>, and re-run it as a daemon container:

```
> docker run -d --name simple-server-test ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh
```

Now that it's running in the background, let's check on it:

```
> docker ps -a                    # list all containers and some metadata about them
> docker logs simple-server-test  # show the stdout of the process that was run within your container
> docker rm -f simple-server-test # destroy the container, even if it is currently running
```

As you're testing, you'll probably create a lot of junk containers. You can nuke them all via:
```
> docker rm -f $(docker ps -a -q)
```

## Finishing off our Docker Host

Our simple server doesn't need a database, and each database has different requirements. However, if you've managed to set up your service to use your database, the configuration will be very similar. So to keep our focus on scaling, I'll be skipping the database for now. At the end of this post, I'll point you to a sample scaled application that makes full use of a database, so don't fret!

As for the data volume, I suggest [reading this](https://docs.docker.com/engine/userguide/containers/dockervolumes/), which will teach you everything you need to know about volume containers.

## Deploying to our Host

We're ready to start deploying our containers! Because creating and destroying containers is so easy, we can test our full system deployment locally before doing so on our dev, staging, or production hosts.

You'll need a Host to test this. However, if you don't have one, just stick with the docker-machine provided hosts for now. You could even play with docker-machine and create a staging host, if you really want to separate things.

All you need to do is ssh into the host, and run the same docker commands as usual (no need to ssh if you're using docker-machine). In the next section, where we start scaling, we'll go over creating a deploy script that does all the work for us.

Let's get to scaling!

# Scaling Docker Services

Believe it or not, setting up the initial Docker Host will probably take longer that scaling it, since further work uses the same techniques we've just covered.

## Simple Horizontally Scaling

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step4</code>.</p>

First we need to scale our service horizontally. Outside of docker, this just means having multiple servers available, so that if one goes down we're alright, and if we have a lot of requests, we can distribute them.

This is incredibly easy to do in docker:

```
> docker run -d --name simple_1 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_2 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_3 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_4 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
```

Hey look at that! We just scaled our service to 4 nodes! Of course, we don't want to have to do this manually, so let's look at how our deploy script manages this for us.

The <code>resources/server-scripts/deploy.sh</code> script takes several options and arguments. It takes care of logging in, checking that our docker machine is ok, cleaning up existing containers, and generally making deployments easy.

Let's play with the script a bit:

```
> resources/server-scripts/deploy.sh
Usage:
  deploy.sh [-h|--help] num_servers

Options:
  -h|--help            Display this help
  --prefix             The prefix for the names of each server container

Arguments:
  num_servers          The number of servers to create


> resources/server-scripts/deploy.sh 4
...
Starting new server containers...
cac317de62a3
0318c5bfcc30
49cbcafbb6c9
98393db53211


> docker logs server_1
Starting server on port 8080
Serving HTTP on 0.0.0.0 port 8080 ...


> docker logs server_4
Starting server on port 8080
Serving HTTP on 0.0.0.0 port 8080 ...


> resources/server-scripts/deploy.sh 10
...
Cleaning up any existing containers...
cac317de62a3
0318c5bfcc30
49cbcafbb6c9
98393db53211
Starting new server containers...
3050f23df4c4
0414c63df057
7d74047078ef
654b7bc662fd
0c6bd3d2cc52
7f1c99f9f2f1
3a7397f1a0bd
6ad940128667
06a1f298fc0c
0de416ccd931
```

## Load Balancing and Service Discovery

So we've got horizontally scaling containers. But we don't want people to have to connect to them manually, and we'd like them to be used equally. That's where load balancing comes in:

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/load-balancing/' >
<p>Here's a host as with a single container.</p>
<p>To scale it horizontally, we just have to add more containers. This is dead simple with docker.</p>
<p>Finally, we load balance them behind a reverse proxy - all requests can go to the proxy instead of the servers, and it'll take care of sharing the load.</p>
</div>

Haproxy was chosen here simply because it's performant, scales well, and is highly configurable.

At this point we can make a scalable service by scaling our service containers and putting them behind reverse-proxy nodes. If we increase the number of containers and services, an important pattern shows up:

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/adding-services/' >
<p>Let's start with a basic host.</p>
<p>We could add more services by just adding different container types. But this won't scale well.</p>
<p>So instead, we'll create _One Service Per Docker Host_. Each Host is the same - same configuration, same deployment process. It just has a different service container inside.</p>
<p>Scaling is now just a matter of adding containers.</p>
<p>We can add containers where they're needed...</p>
<p>...thus scaling each host independently.</p>
<p>We can even scale our load balancers the same way!</p>
</div>

To add a load balancer, we're going to need a new dockerfile for haproxy, give it some basic configuration, then update our deploy script. You probably already have an idea of how that would look. But hold tight! There's a key weakness in the setup we've just described that we need to address.

Whenever we add or remove containers, we need to manually update our load balancers' configuration, so it knows what containers to balance. Which means we have to know how many containers we have ahead of time... which means we can't scale on demand, we need to re-deploy our entire host every time we want to add or remove containers.

The solution? Service Discovery:

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/service-discovery/' >
<p>Service discovery first requires we keep an up to date inventory of all of our containers. In this case, I've created a few [Consul](https://www.consul.io/) servers, which will keep track of our containers internally.</p>
<p>Each container is updated to have a [Consul Agent](https://www.consul.io/docs/agent/basics.html), which connects to the Consul Servers, thus keeping them up to date. The masters share their connected servers with each-other, to ensure consistency.</p>
<p>If a container is added, its agent connects to the Quorum (the Servers that are still up and communicating correctly), which updates the inventory.</p>
<p>If containers are lost, they disconnect from the Quorum, thus removing them from the inventory.</p>
</div>

This gives us an up-to-date inventory of all of our containers. All we have to do is consume this inventory. We can use another consul agent for that - put the agent on the load balancer container, and any time it sees the inventory change, update the load balancers' config automatically.

There's a tool built by the same people that made consul that solves this exact problem! It's called Consul Template.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/consul-template/' >
<p>We install consul-template on the load balancer container, just like a regular consul agent. As it's connected to the Consul Servers, it will automatically receive updates whenever the inventory changes.</p>
<p>On the load balancer we put a configuration template. This is a [Go Template](https://gohugo.io/templates/go-templates/) that, when applied to the inventory, will generate our load balancers config.</p>
<p>Upon receiving an inventory update, consul-template will apply the new inventory to the template, and generate a standard [haproxy config file](https://www.digitalocean.com/community/tutorials/how-to-use-haproxy-to-set-up-http-load-balancing-on-an-ubuntu-vps#configuring-haproxy).</p>
<p>Finally, it tells the haproxy service to restart, which picks up the new configuration.</p>
</div>

And with that, we're finally able to implement our load balanced, discoverable and auto updating docker hosts!

## Testing Load Balancing and Service Discovery

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step5</code>.</p>

Now that we've gone over how service discovery and load balancing work, we can start playing with the example project to get a deeper understanding. We'll do this by using our deploy script, and looking at the various moving parts.

If you're testing with a docker machine, you'll need to either login to the machine and curl endpoints to test them, or forward ports in virtual box. Since the latter is a much nicer experience, I'll go over that first.

Open up virtualbox, find your machine, right click, and select settings. Then select the Network tab, and click Port Forwarding. Then setup your ports as follows (don't change the ssh one):

{{< img-post "" "img/Scaling-With-Docker-Part-2/virtualbox-ports.png" "VirutalBox Port Configuration">}}

Now you can hit your load balancers by going to <code>localhost:8X8X</code> on your local machine, or go to <code>localhost:8501/</code> to check on the status of consul:

{{< img-post "" "img/Scaling-With-Docker-Part-2/consul-ui.png" "VirutalBox Port Configuration">}}

Now lets play around with it a bit:

```stuff
> resources/server-scripts/deploy.sh
Usage:
  deploy.sh [-h|--help] [-c|--consul] [-l|--lb num_lbs] num_servers

Options:
  -h|--help            Display this help
  -c|--consul          Whether to redeploy the consul servers
  -l|--lb num          How many load balancers to deploy. Defaults to 0
  --prefix             The prefix for the names of each server container

Arguments:
  num_servers          The number of servers to create


> resources/server-scripts/deploy.sh -c -l 3 10
...
Starting new consul server containers...
17a7391062e70
e5126c48b5d4e
ffaa15395ee75
b3f4118b623b7
b50fa883b3aec
Giving consul servers a few seconds to elect someone...
  The ui is available on each server, under port 850X, where X is the server number
Finished deploying consul cluster!
Starting new load balancer containers...
07bd11df2998a
d39c0a2489592
a0c03230b1923
Starting new server containers...
ab74f9554cf6f
0307d1b14f27b
918c8f8c8cc60
6089a9bfa0d28
6b42d17cbcb26
0b4115ab85b4c
33095aba5cf6a
eadfd5802b32c
fbf36c26f9b4b
b116d95d7b5cd


> curl localhost:8181
...
> curl localhost:8181
...
> curl localhost:8181
...

> docker-machine ssh
>> docker inspect simple_haproxy_1 | grep "Mounts" -A 3
>> ... # prints the location of the volume on disk, so that we can go look at the proxy logs
>> sudo -i
>> cd /mnt/sda1/var/lib/docker/volumes/4bd9e9e016c20c4628b52416fededb25bc6f2028c30c5d4a034d73cbae56b44c/_data
>> cat haproxy_0.log
2016-... http-in webservers/server_1 ...
2016-... http-in webservers/server_2 ...
2016-... http-in webservers/server_3 ...
```

From the above, you can see that the load balancer sent the first request to server_1, the second request to server_2, and the final request to server_3.

You can check real time service discovery is working by destroying some containers, then checking on consul:
 
```
> docker rm -f server_1
> docker rm -f server_4
> docker rm -f simple_consul_3
```

{{< img-post "" "img/Scaling-With-Docker-Part-2/consul-ui-after-killing.png" "VirutalBox Port Configuration">}}

Note that haproxy doesn't show up in the consul list because consul-template is not a typical agent - it wouldn't be that difficult to add it using the same technique we used for our services.

# Large Scale Docker

Great! We've got a scalable resilient docker host! You can add a few more hosts, and thus more services, using the same techniques described here. Then you can connect them by opening ports, or by using an [overlay network](https://docs.docker.com/engine/userguide/networking/get-started-overlay/).

This will suit most personal projects and small to medium scale deployments. But a few issues arise when you try to take this to very large scale.

## Problems With Current Solution

* Maintenance - Maintaining a few hosts like this is manageable. Maintaining hundreds or thousands of them is not. The same goes for monitoring tens of thousands of containers.
* Resource Utilization - Right now we're not using our machines to their full potential. Maybe a service doesn't need an entire host? Maybe it needs multiple hosts?
* Localization - Because we have one service per host, it's hard to localize, at least without greatly increasing our maintenance overhead. Also, if a host is destroyed, we lose that entire service - there's no automatic recovery in the event of a fire.

There are a few developing solutions to this; all of them revolve around the idea of a special set of servers that manage your containers and hosts for you. Kubernetes and Mesos seem the most popular for large scale deployments, and Docker's own Swarm is an easier to use tool more suited to medium sized deployments.

Mesos and Kubernetes have two have mutually exclusive models - Mesos abstracts a set of hosts into large data centers and is very generic, whereas Kubernetes provides an opinionated management layer on top of container clusters. As a result, Kubernetes tends to be easier to use, but Mesos is more general purpose. Neither is restricted to just running Docker Containers either - both can abstract all kinds of machines. Swarm has more in common with Kubernetes than Mesos in terms of API, but it is Docker specific, and the common opinion in the scaling community is that it is not yet well suited to very large scale systems. That being said it is evolving rapidly, and it's worth experimenting with it if your application is not expected to reach very large scale in the near future - its ease of use may well outweigh its limitations for all but the largest deployments.

Though Mesos and Kubernetes both have merits (every week it seems they trade first and second place), they are similar enough that I will just focus on Mesos.

# Mesos

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/mesos-overview/' >
<p>Mesos lets you abstract a set of hosts into a single Megacluster. It breaks all of your hosts down into resources, and manages them for you by deciding what and where to provision. Each Host in a Mesos megacluster is a Mesos Slave. This megacluster is often called a DCOS, or Data Center Operating System.</p>
<p>The main work is done by Mesos masters - only one is managing the cluster at a time, but there are several of them kept up to date with the system, in case one of them fails. This syncronization is done in a similar manner to our Consul servers, though it is done with [Zookeeper](https://zookeeper.apache.org/doc/trunk/zookeeperOver.html).</p>
<p>Mesos handles deploying our containers onto our hosts for us. It determines where a container will fit based on the resources available on each host, thus using our resources more efficiently. Any container can be placed on any host.</p>
<p>We're not limited to a single megacluster either. And since each megacluster contains every type of container, localizing our servers becomes much simpler.</p>
</div>

This address each of our original concerns about large scale Docker deployments. Maintenance becomes less of an issue, since all of the hosts are now the same - they can all be provisioned the same way, and the Mesos Masters will take care of managing the contents of each host. Resource utilization is one of Mesos' strongest points; the masters break each host into abstract resources like CPU and RAM, and create Docker Containers wherever they fit. This means if a container doesn't need many resources, it won't consume many. Finally, localization is largely resolved by simply adding more megaclusters. Each megacluster has the same configuration, and can run every type of container. This means we can have localized services wherever we need them. Plus, if one of our hosts dies, Mesos just puts those containers on different hosts.

This convenient management of hosts takes quite an effort to configure. But once complete, the payoff is huge - some companies claim they can manage thousands of hosts and up to a hundred thousand containers on Mesos.

## Orchestration and Scheduling

Mesos provides Orchestration of your hosts. It orchestrates it by Scheduling processes amongst the various hosts. Orchestration and Scheduling are the common ground amongst all large scale management systems.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/mesos-scheduling/' >
<p>Mesos manages your hosts, by abstracting them into resources like CPU and RAM. On each Host, the Mesos Slave daemon is installed, and it's job is to keep track of the available resources on a host, reporting the available resources to the masters.</p>
<p>The slaves periodically report their available resources. These are updated as resources are consumed and released.</p>
<p>The masters, who track all of the resources amongst all hosts, make offers to Schedulers. The offers say what resources are available across the whole system, and a Schedulers first job is to pick the resources it wants.</p>
<p>The Scheduler then accepts a subset of the resources, and tells the master what resources it wants and why it wants them. It tells the masters to pass a job to an Executor, who will consume the resources.</p>
<p>The masters tell the required Executors to "execute" the jobs, which in our case means creating containers.</p>
</div>

If you've ever looked up Mesos and Docker, you've probably also come across Marathon. The combination of a Scheduler and an Executor makes up a Mesos Framework. Marathon is a Framework specializing in long running processes, like containers.

## Transferring our Services to Mesos

Implementing a Mesos system is far beyond the scope of this post. It's no simple task - it takes a significant time investment to get it working, and there's no "standard" way to do it yet. However, it should be clear from our discussion above where each component translates to. Here's a quick overview of what needs to be done:

* Instead of managing our Hosts with shell scripts, we'll be shifting that responsibility to Marathon - this might just mean moving and adjusting the scripts, depending on how you decide to implement your stack. Though it's simple to describe, this step will take a large portion of the time in setting up Mesos.
* We'll need to install Mesos on each of our Docker hosts to convert them into Mesos Slaves.
* Mesos Masters will have to be provisioned and configured with our Marathon setup. Then they need to be connected to the slaves.
* You'll have to convert some of your existing solutions to Mesos. Do you want to continue running Consul for service discovery, or switch over to Mesos DNS? In either case, configuration will have to be adjusted.
* You'll probably want to explore the other features of Mesos. Frameworks like Chronos can help you manage backups and periodic tasks, and Marathon can be used for more than just containers.

# Summary

We've gone over deploying a service onto a docker host, scaling that service horizontally to multiple containers, load balancing them, and adding service discovery for fluid and reliable container deployments. We've shown how this scales to several hosts, and where the limitations of this system are. And we've overviewed how the various Orchestration frameworks, particularly Mesos, help us take our deployments to very large scales.

Docker and the strategies for scaling it are still in their infancy - they're constantly evolving and improving. The best way to get a handle on them is to try them yourself, and see what works for you.

I hope you've found the example project helpful. If you want to see a more fleshed out service that utilizes all these techniques, feel free to checkout another project of mine - [Elophant](https://github.com/bcokert/elophant). This project is still under development, but it may answer a few questions that come up as you play with your own docker services.

Happy Scaling!
