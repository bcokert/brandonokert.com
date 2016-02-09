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

I've implemented an example project on [github](https://github.com/bcokert/scaling-with-docker-example). You can clone that and look at the code at each stage if you don't have a server you want to try it with yourself. Just checkout the specified tag in each section to see it as it was.

# Getting Ready

I'll be going step by step on how to set things up on OSX and Linux in parallel (since setting up on Linux is basically a subset of the OSX requirements). If you're on Windows, the steps for OSX will be almost the same, but you'll have to translate terminal commands as necessary.

We're going to need a few things to build our Docker host. We need a service to work with. We need to install Virtual Box to run our docker hosts (linux servers can be hosts, but you'll want more than 1 for testing). And we'll need Docker itself.

## Service

If you've already got a service you want to test with, great! The steps I'll provide will apply to any service that produces a standalone executable. For environments like Apache/PHP, I'll point out how it differs.

If you don't have a service, don't fret! I'll be using a toy service in all of my examples, so that it's easy to run a working version.

If you want to use the toy service, please do the following:
```bash
> mkdir src
> touch src/runserver.sh
> sudo chmod a+x src/runserver.sh
> touch src/example1.html
> touch src/example2.html
> export SIMPLE_SERVER_PORT=8080
```

Then edit runserver.sh to look like this:
```bash runserver.sh
#!/bin/sh

echo "Starting server on port $SIMPLE_SERVER_PORT"
python -m SimpleHTTPServer $SIMPLE_SERVER_PORT
```

Finally, put some valid html into example1.html and example2.html. If you're familiar with python simple server, feel free to set it up however you like - just make sure the port is an environment variable.

You can test it by going into the src folder and running <code>./start.sh.</code> Then browse to <code>localhost:8080/example1.html</code> to see if it hits our "endpoint".

Later when we develop the build and deploy scripts, we'll "build" it by just copying the content of src/ to build/.

If you want to see this step in the example project, run <code>git checkout step1</code>.

## Virtual Box

If you're on OSX or Windows, virtual box will be installed for you when you install Docker Toolbox (if you don't already have it). Otherwise, install via your favorite package manager or the [downloads page](https://www.virtualbox.org/wiki/Downloads). Version shouldn't matter, but you don't want one too old. Also, make sure to install the extensions if prompted.

We'll be using Docker Machine to actually create and manage our VM's, so once you're installed, you're good to go.

## Docker and Docker Toolbox

On linux, you can install each package individually. On OSX and Windows, installing Toolbox will install everything else you need.

I'm going to leave the installing to the [fine documentation on the docker website](https://docs.docker.com/engine/installation/), as it's pretty comprehensive, and changes from version to version.

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

Let's jump right into the first Dockerfile.

```bash
> mkdir -p resources/dockerfiles
> touch resources/dockerfiles/dockerfile-server
```

Remember the process of creating an image from a dockerfile?

<div class='sequenced-image' data-base='/img/Scaling-With-Docker-Part-1/images-and-dockerfiles/' >
<p>On the right is our Dockerfile. On the left, the image made from it.</p>
<p>The first command is always a FROM command. You specify a base image here to get a default set of libraries and configuration, for a specific platform. You can also specify scratch as a base image, meaning that no files and configuration will be installed.</p>
<p>The next commands are to setup the dependencies of your runtime. This is no different from the steps you'd run in a provisioner, like Ansible. You might also get some of your dependencies from the base image itself. There's a java:8 base image for example, as well as a consul one.</p>
<p>Next you install your app itself, as well as any local configuration. This is the deploy artifact you generate via your build tools.</p>
<p>After this, you can do any container specific setup. Open ports, setup environment variables, mount volumes, anything. Ideally you'll keep the number of commands to a minimum, as each command creates a new layer in your image.</p>
<p>Once you've created, pushed up, and pulled down an image, you can create a container via the docker run command. The path to init script would have been copied over when you installed the application artifact.</p>
</div>

Let's create a dockerfile for our service by opening up <code>dockerfile-server</code>.

```
# Use an alpine linux distro (nice and small), that already has python as a base
FROM python:2.7-alpine

# Dependencies
# Put any dependencies here, eg:
# RUN apt-get install java

# Server
# change directory to the given location, running future commands in it
WORKDIR /usr/local/lib
# copy output_dir/simple-service folder to /usr/local/lib/simple-service
COPY simple-service simple-service/
# set an environment variable. We'll see another way to set these shortly
ENV SIMPLE_SERVICE_PORT 8080
# open port 8080 from container to dockerhost
EXPOSE 8080
```

Notice that we don't build our application here - we run the dockerfile _after_ we've compiled our project.

If you want to see this step in the example project, run <code>git checkout step2</code>.

## Creating and Storing Images

We can compile our image simply by running:
```bash
> docker build -t REPOSITORY_NAME/IMAGE_NAME:VERSION_NAME BUILD_DIRECTORY -f DOCKERFILE_NAME
```

For example: <code>docker build -t mycompany/webservice:latest ./build -f dockerfile-server</code>.

However, this requires we already have a registry setup, and a docker host ready to go. If you don't want to build the image yourself, you can download a ready to go image from [my dockerhub repo](https://hub.docker.com/r/bcokert/simple-server/), which I'll cover below.

### Registry

If you've got a registry already, feel free to use it. Otherwise, take a minute to go to [dockerhub](https://hub.docker.com/) and setup an account, then [create a repository](https://hub.docker.com/add/repository/) called <code>example-server</code>.

Once you've done so, you can login to dockerhub via <code>docker login</code>.

### Docker Host

For most of this tutorial we'll be using the default box. There's nothing special about this box, except that in docker 1.10 and higher if you omit the name in commands, it will automatically look for a machine called "default":

```bash
> docker-machine create --driver virtualbox default
...
```

Once it's done, you can technically log into it via <code>docker-machine ssh default</code>, and then use your docker commands from there. However, with docker-machine it is common to export some environment variables to enable using docker directly from your terminal.

To see what these are, go ahead and run <code>docker-machine env default</code> (remember, if you omit the name, it automatically uses default):

```bash
> docker-machine env default
export DOCKER_TLS_VERIFY="1"
export DOCKER_HOST="tcp://192.168.99.100:2376"
export DOCKER_CERT_PATH="/Users/username/.docker/machine/machines/default"
export DOCKER_MACHINE_NAME="default"
```

You can either run <code>eval "$(docker-machine env default)"</code> in your terminal before using docker (I use an alias for different machines), or you can put that directly into your bash_profile if you only plan on using the default machine. If you run fish terminal (or a more esoteric one), you might need to [pass something special to the --shell option of env](https://docs.docker.com/machine/reference/env/).

### Putting it together

Instead of pushing up manually, we're going to go right to automating our build process to make this is quicker down the road:

```bash
> mkdir resources/dev-scripts
> touch resources/dev-scripts/build-service.sh
> sudo chmod a+x resources/dev-scripts/build-service.sh
```

Let's edit the <code>build-server.sh</code> to automatically check that we're logged in, check that the default machine is running, create an image, and push it up to dockerhub for us. I've used an environment variable, <code>DOCKER_REPOSITORY</code>, to store our repository name so you don't need to copy paste your own repo in all the time.

```bash
#!/usr/bin/env bash
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"/../..
SOURCE_DIR=${ROOT_DIR}/src
RESOURCE_DIR=${ROOT_DIR}/resources
DOCKERFILE_DIR=${RESOURCE_DIR}/dockerfiles
ARTIFACT_DIR=${ROOT_DIR}/build
OUTPUT_DIR=${ROOT_DIR}/release-server-tmp

DOCKER_MACHINE_NAME=default
REPOSITORY=${DOCKER_REPOSITORY}
DOCKER_FILE_NAME=dockerfile-server
IMAGE=simple-server

# Some nice red text for the terminal
ERROR_TXT="\033[1m\033[41m\033[97mERROR:\033[0m"

echo "Checking that docker VM is available..."
if ! docker-machine ls | grep -q ${DOCKER_MACHINE_NAME}; then
  echo -e "${ERROR_TXT} Docker VM is not created. Please run 'docker-machine create --driver virtualbox ${DOCKER_MACHINE_NAME}'"
  exit 1
elif ! docker-machine ls | grep -q ${DOCKER_MACHINE_NAME}.*Running; then
  echo -e "${ERROR_TXT} Docker VM is not running. Please run 'docker-machine start ${DOCKER_MACHINE_NAME}'"
  exit 1
fi

echo "Cleaning any old release files..."
rm -rf ${OUTPUT_DIR}
mkdir ${OUTPUT_DIR}

echo "Building project..."
# Build your project here, if applicable
cp -r ${SOURCE_DIR}/ ${OUTPUT_DIR}/simple-service # "Build" our toy service

echo "Preparing build artifacts for docker imaging..."
# Do any post-build setup here, like unzipping files
cp ${DOCKERFILE_DIR}/${DOCKER_FILE_NAME} ${OUTPUT_DIR}

echo "Connecting to Docker VM..."
eval "$(docker-machine env ${DOCKER_MACHINE_NAME})"

echo "Building Docker Image..."
ls ${OUTPUT_DIR}
ls ${OUTPUT_DIR}/simple-service
docker build -t ${REPOSITORY}/${IMAGE}:latest -f ${OUTPUT_DIR}/${DOCKER_FILE_NAME} ${OUTPUT_DIR} || exit 1
docker images | grep ${IMAGE} # list our new images info

echo "Cleaning up build artifacts..."
rm -rf ${OUTPUT_DIR}

echo "Checking that you are logged in to docker hub..."
if ! docker info | grep -q Username; then
  echo "You must login to push to docker Hub (you only need to do this once):"
  docker login
else
  echo "Succesfully logged in!"
fi

echo "Pushing docker images..."
echo "If this fails saying it's already in progress, try 'docker-machine restart ${DOCKER_MACHINE_NAME}'"
docker push ${REPOSITORY}/${IMAGE}
```

If you want to see this step in the example project, run <code>git checkout step3</code>. If you don't want to build the image, you can use a prebuilt one [in my dockerhub repo](https://hub.docker.com/r/bcokert/simple-server/). Just run <code>docker pull bcokert/simple-server</code>.

## Testing our Image

Let's give this container a quick test to make sure it's setup properly:

```sh
> docker pull ${DOCKER_REPOSITORY}/simple-server
> docker run --name simple-server-test ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh
...
```

When you do this, your terminal will start receiving logs from that container. Kill it with ctrl-C, remove the now stopped container with <code>docker rm simple-server-test</code>, and re-run it as a daemon container:

```sh
> docker run -d --name simple-server-test ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh
```

Now that it's running in the background, let's check on it:

```sh
> docker ps -a                    # list all containers and some metadata about them
> docker logs simple-server-test  # show the stdout of the process that was run within your container
> docker rm -f simple-server-test # destroy the container, even if it is currently running
```

As you're testing, you'll probably create a lot of junk containers. You can nuke them all via:
```sh
> docker rm -f $(docker ps -a -q)
```

## Finishing off our Docker Host

The initial docker host is almost good to go.


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
