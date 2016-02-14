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

This is the second in a two part blog about Scaling with Docker. In this part, we'll take what we learned in Part 1 and use it to create a scalable and resilient service with Docker. While the previous part took a more conceptual route, this part will focus more on practical applications. We'll incrementally build up a set of scripts to manage deploying our hosts, applying each concept as it's described. Then I'll show you how you can use the same techniques on multiple services, and finally give an overview of how to scale massively, to thousands of hosts.

I've implemented an example project on [github](https://github.com/bcokert/scaling-with-docker-example). As you go through the steps here, I'll let you know when to check out different tags, if you want to follow along with the code.

# Getting Ready

I'll be going step by step on how to set things up on OSX and Linux in parallel (since setting up on Linux is basically a subset of the OSX requirements). If you're on Windows, the steps for OSX will be almost the same, but you'll have to translate terminal commands as necessary.

We're going to need a few things to build our Docker host. We need a service to work with. We need to install Virtual Box to run our docker hosts. And we'll need Docker itself.

## Service

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step1</code></p>

If you've already got a service you want to test with, great! If not, I'll be using a toy service in all of my examples, so that it's easy to play with the scaling without dealing with a complex service. To use your service instead of the toy one, just replace the toy service with yours in the build-scripts and deploy-scripts - I'll point out where you need to do this.

You can test the toy service by going into the src folder and running <code>./start.sh.</code> Then browse to <code>localhost:8080/example1.html</code> to see if it hits our "endpoint". I've made 2 endpoints for your testing pleasure.

Later when we develop the build and deploy scripts, we'll "build" it by just copying the content of <code>src/</code> to <code>build/</code>.

## Virtual Box

If you're on OSX or Windows, virtual box will be installed for you when you install Docker Toolbox (if you don't already have it). Otherwise, install via your favorite package manager or the [downloads page](https://www.virtualbox.org/wiki/Downloads). Version shouldn't matter, but you don't want one too old. Also, make sure to install the extensions if prompted.

We'll be using Docker Machine to actually create and manage our VM's, so once you're installed, you're good to go.

## Docker and Docker Toolbox

On linux, you can install each package individually. On OSX and Windows, installing Toolbox will install everything else you need.

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

Throughout this post, most of the work will be done with shell scripts. This is to make it maximally transferable, and easy to understand what's going on. If you're already comfortable with tools like Docker Compose, feel free to use that instead.

We'll need a few scripts by the end:

* <code>resources/dockerfiles/dockerfile-X</code> - these will be our dockerfiles, which we'll need one of per image
* <code>resources/dev-scripts/build-X.sh</code> - these will update our docker images when the underlying application or service changes, and push the results up to the registry. We'll need one per image type.
* <code>resources/server-scripts/deploy.sh</code> - this is a server side script, and deploys an entire host. For complex applications, you'd probably split this into a few scripts, but we'll just use 1 for brevity. This script will deploy ALL of our containers, and it's arguments will determine how we scale.

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

You run <code>eval "$(docker-machine env default)"</code> in your terminal before using docker (I use an alias for different machines). If you run fish terminal (or a more esoteric one), you might need to [pass something special to the --shell option of env](https://docs.docker.com/machine/reference/env/).

### Putting it together

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step3</code>.</p>

Instead of pushing up manually, we're going to go right to automating our build process to make this is quicker down the road.

The <code>resources/dev-scripts/build-service.sh</code> script automatically checks that we're logged in to docker hub, makes sure the right docker machine is running and available, creates our image, and pushes it up to our repository for us. If you're following along and have your own repository, use the environment variable <code>DOCKER_REPOSITORY</code> to avoid having to copy paste your repository all over the place.

The key part of the build processes is building our actual project - compiling, bundling, minifying, or whatever "building" means for your project. The end result should be a set of artifacts, which we then just copy into our image.

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

Our simple server doesn't need a database, and each database has different requirements. However, if you've managed to set up your service to use your database, the configuration will be very similar. So to keep our focus on scaling, I'll be skipping the database for now. At the end of this tutorial, I'll go over a sample scaled application that makes full use of a database, so don't fret!

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

First we need to scale our service horizontally. In non-docker speak, this just means having multiple servers available, so that if one goes down we're alright, and if we have a lot of requests, we can distribute them.

This is incredibly easy to do in Docker - it's one of the reasons docker is nice to deploy with.

```
> docker run -d --name simple_1 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_2 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_3 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_4 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
```

Hey look at that! We just scaled our service to 4 nodes! Of course, we don't want to have to do this manually, so let's setup our deploy script now.

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

At this point, we can make a scalable service, by scaling our service containers and putting them behind reverse-proxy nodes. If we increase the number of containers and services, an important pattern shows up:

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/adding-services/' >
<p>Let's start with a basic host.</p>
<p>We could add more services by just adding different container types. But this won't scale well.</p>
<p>So instead, we'll create _One Service Per Docker Host_. Each Host is the same - same configuration, same deployment process. It just has a different service container inside.</p>
<p>Scaling is now just a matter of adding containers.</p>
<p>We can add containers where they're needed...</p>
<p>...thus scaling each host independently.</p>
<p>We can even scale our load balancers the same way!</p>
</div>

To add a load balancer, we're going to need a new dockerfile for haproxy, give it some basic configuration, then update our deploy script. You probably already have an idea of how that would look. But hold tight! There's a key weakness in the setup we've just described that we need to address!

Whenever we add or remove containers, we need to manually update our load balancers configuration, so it knows what containers to balance. Which means we have to know how many containers we have ahead of time... which means we can't scale on demand, we need to re-deploy our entire host every time we want to add or remove containers.

The solution? Service Discovery:

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/service-discovery/' >
<p>Service discovery first requires we keep an up to date inventory of all of our containers. In this case, I've created a few [Consul](https://www.consul.io/) servers, which will keep track of our containers internally.</p>
<p>Each container is updated to have a [Consul Agent](https://www.consul.io/docs/agent/basics.html), which connects to the Consul Servers, thus keeping them up to date. The masters share their connected servers with each-other, to ensure consistency.</p>
<p>If a container is added, its agent connects to the Quorum (the Servers that are still up and communicating correctly), which updates the inventory.</p>
<p>If containers are lost, they disconnect from the Quorum, thus removing them from the inventory.</p>
</div>

This gives us an up-to-date inventory of all of our containers. All we have to do is consume this inventory. We can use another consul agent for that - put the agent on the load balancer container, and any time it sees the inventory change, update the load balancers config automatically.

There's a tool built by the same people that made consul that solves this exact problem! It's called Consul Template.

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-2/consul-template/' >
<p>We install consul-template on the load balancer container, just like a regular consul agent. As it's connected to the Consul Servers, it will automatically receive updates whenever the inventory changes.</p>
<p>On the load balancer we put a configuration template. This is a [Go Template](https://gohugo.io/templates/go-templates/) that, when applied to the inventory, will generate our load balancers config.</p>
<p>Upon receiving an inventory update, consul-template will apply the new inventory to the template, and generate a standard [haproxy config file](https://www.digitalocean.com/community/tutorials/how-to-use-haproxy-to-set-up-http-load-balancing-on-an-ubuntu-vps#configuring-haproxy).</p>
<p>Finally, it tells the haproxy service to restart, which picks up the new configuration.</p>
</div>

And with that, we're finally ready to start implementing our load balanced, discoverable and auto updating docker hosts!

## Testing Load Balancing and Service Discovery

<p class='follow-prompt'>If you're following along with the code, please run <code>git checkout step5</code>.</p>

Now that we've gone over how service discovery and load balancing work, we can start playing with the example project to get a deeper understanding. We'll do this by using our deploy script, and looking at the various moving parts.

If you're testing with a docker machine, you'll need to either login to the machine and curl endpoints to test them, or forward ports in virtual box. Since the latter is a much nicer experience, I'll go over that first.

Open up virtualbox, find your machine, right click, and select settings. Then select the Network tab, and click Port Forwarding. Then setup your ports as follows (don't change the ssh one):

![VirutalBox Port Configuration](/img/Scaling-With-Docker-Part-2/virtualbox-ports.png)

Now you can hit your load balancers by going to <code>localhost:8X8X</code> on your local machine, and go to <code>localhost:8501/</code> to check on the status of consul:

![VirutalBox Port Configuration](/img/Scaling-With-Docker-Part-2/consul-ui.png)

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


> curl localhost:8181/example1.html
...
> curl localhost:8181/example1.html
...
> curl localhost:8181/example1.html
...

> docker-machine ssh
>> docker inspect simple_haproxy_1 | grep "Mounts" -A 3
>> sudo -i
>> cd /mnt/sda1/var/lib/docker/volumes/4bd9e9e016c20c4628b52416fededb25bc6f2028c30c5d4a034d73cbae56b44c/_data
>> cat haproxy_0.log
2016-... http-in webservers/server_1 ...
2016-... http-in webservers/server_2 ...
2016-... http-in webservers/server_3 ...
```

You can check real time service discovery is working by destroying some containers, then checking on consul:
 
```
> docker rm -f server_1
> docker rm -f server_4
> docker rm -f simple_consul_3
```

![VirutalBox Port Configuration](/img/Scaling-With-Docker-Part-2/consul-ui-after-killing.png)

Note that haproxy doesn't show up in the consul list because consul-template is not a typical agent - it wouldn't be that difficult to add it though.

# Large Scale Docker

Great! We've got a scalable resilient docker host! You can add a few more hosts, and thus more services, using the same techniques described here.

This will suit most personal projects and small to medium scale deployments. But a few issues arise when you try to take this to very large scale.

## Problems With Current Solution

* ...
* ...

## General Strategy - The DCOS

# Mesos

## Abstraction of Docker Hosts

## Scheduling Containers
