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

The initial docker host is almost good to go. All we're missing from the original image is the database container and our data volume.

Our simple server doesn't need a database, and each database has different requirements. However, if you've managed to set up your service to use your database, the configuration will be very similar, since we won't be scaling the database (due to the [CAP theorem](http://robertgreiner.com/2014/08/cap-theorem-revisited/) - later we'll see how to add consul to our service to provide a different kind of scaled data).

So to keep our focus on scaling, I'll be skipping the database for now. At the end of this tutorial, I'll go over a sample scaled application that makes full use of a database, so don't fret!

As for the data volume, I suggest [reading this](https://docs.docker.com/engine/userguide/containers/dockervolumes/), which will teach you everything you need to know about volume containers.

## Deploying to our Host

We're ready to start deploying our containers! Because creating and destroying containers is so easy, we can test our full system deployment locally before doing so on our dev, staging, or production hosts.

You'll need a Host to test this. However, if you don't have one, just stick with the docker-machine provided hosts for now. You could even play with docker-machine and create a staging host, if you really want to separate things.

All you need to do is ssh into the host, and run the same docker commands as usual. In the next section, where we start scaling, we'll go over creating a deploy script that does all the work for us.

Let's get to scaling!

# Scaling Docker Services

Believe it or not, setting up the initial Docker Host will probably take longer that scaling it, since further work uses the same techniques we've just covered. If you already had a docker project that you just wanted to scale, here's where you'll really jump in.

You can work through the code examples, or run <code>git checkout step4</code> to look at the complete example. 

## Simple Horizontally Scaling

First up we need to scale our service horizontally. In non-docker speak, this just means having multiple servers available, so that if one goes down we're alright, and if we have a lot of requests, we can distribute them.

This is incredibly easy to do in Docker - it's one of the reasons docker is nice to deploy with.

```sh
> docker run -d --name simple_1 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_2 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_3 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
> docker run -d --name simple_4 ${DOCKER_REPOSITORY}/simple-server /usr/local/lib/simple-service/runserver.sh 
```

Hey look at that! We just scaled our service to 4 nodes! Of course, we don't want to have to do this manually, so let's up our deploy script now.

The deploy script will take several options and arguments, and take care of logging in, cleaning up containers, and generally making deployments easy. It's a little big - don't panic! Most of it is boiler plate, and the really important stuff I've separated out into sections at the bottom.

First, lets create our script:

```bash
> mkdir resources/server-scripts
> touch resources/server-scripts/deploy.sh
> sudo chmod a+x resources/server-scripts/deploy.sh
```

Then, make it look like the following:

```bash
#!/usr/bin/env bash
REPOSITORY=${DOCKER_REPOSITORY}
WEB_IMAGE=simple-server
DOCKER_MACHINE_NAME=default
NETWORK_NAME=network

# These can be modified by options/arguments
INCLUDE_SERVERS=true
SERVER_NAME_PREFIX=server

# A function that prints the help message
function print_usage {
  echo "Usage:"
  echo "  deploy.sh [-h|--help] num_servers"
  echo
  echo "Options:"
  echo "  -h|--help            Display this help"
  echo "  --prefix             The prefix for the names of each server container"
  echo
  echo "Arguments:"
  echo "  num_servers          The number of servers to create"
}

# Process the options and arguments
if [[ $# == 0 ]]; then print_usage; exit 1; fi
while [[ $# > 0 ]] ; do key="$1"
case ${key} in
    -h|--help) print_usage; exit 0;;
    --prefix) SERVER_NAME_PREFIX=$2; shift;;
    -*) echo "Illegal Option: ${key}"; print_usage; exit 1;;
    *) break;
esac
shift
done

# Verify the options and arguments
reNumber='^[0-9]+$'
if [ ${INCLUDE_SERVERS} = true ]; then
  if [[ $1 =~ $reNumber ]]; then
    NUM_SERVERS=$1
  else
    echo "First arg must be a number. Received: '$1'"; print_usage; exit 1
  fi
fi

# Verify that the docker machine is running
if which docker-machine | grep -q /*/docker-machine; then
  echo "Connecting to Docker VM..."
  eval "$(docker-machine env ${DOCKER_MACHINE_NAME})"
fi

# Verify that the network has been created, and create it if not
if ! docker network ls | grep -q ${NETWORK_NAME}; then
  docker network create ${NETWORK_NAME}
fi

# Log in to Docker Hub
echo "Checking that you are logged in to docker hub..."
if ! docker info | grep -q Username; then
  echo "You must login to push to docker Hub (you only need to do this once):"
  docker login
else
  echo "Successfully logged in!"
fi





### SIMPLE SERVERS
if [ ${INCLUDE_SERVERS} = true ]; then
  echo "Deploying Web Servers..."

  echo "Pulling latest server image..."
  docker pull ${REPOSITORY}/${WEB_IMAGE}

  echo "Cleaning up any existing containers..."
  if docker ps -a | grep -q ${SERVER_NAME_PREFIX}; then
    docker rm -f $(docker ps -a | grep ${SERVER_NAME_PREFIX} | cut -d ' ' -f1)
  else
    echo "No existing services to remove"
  fi

  echo "Starting new server containers..."
  for (( i=1; i<=${NUM_SERVERS}; i++ )); do
    docker run -d --net=${NETWORK_NAME} -e SIMPLE_SERVER_PORT=8080 --name ${SERVER_NAME_PREFIX}_${i} ${REPOSITORY}/${WEB_IMAGE} /usr/local/lib/simple-service/runserver.sh
  done
fi
```

Let's play with the script a bit:

### Usage
```bash
> resources/server-scripts/deploy.sh

Usage:
  deploy.sh [-h|--help] num_servers

Options:
  -h|--help            Display this help
  --prefix             The prefix for the names of each server container

Arguments:
  num_servers          The number of servers to create
```

### Deploying some Servers
```bash
> resources/server-scripts/deploy.sh 4
...
Starting new server containers...
cac317de62a3a066df48e7c19b6c0a50c5aac6eaec257b0a14a0e7a4702a9d40
0318c5bfcc303b012ab9cc1f156f7e34fe86a330080b6923a99a2dec23b58178
49cbcafbb6c9991c04deb7a4248c154694d36b7687a2623d01ce167003923b61
98393db532114707d104cf335b0c3513a83092543f61ce0f3433416252cf077b

> docker logs server_1
Starting server on port 8080
Serving HTTP on 0.0.0.0 port 8080 ...

> dcoker logs server_4
Starting server on port 8080
Serving HTTP on 0.0.0.0 port 8080 ...
```

### Cleaning up old Servers
```bash
> resources/server-scripts/deploy.sh 5
...

> resources/server-scripts/deploy.sh 10
...
Cleaning up any existing containers...
f4a9e5cc8175
d5fe92720d43
fa11554a47b3
cb718508c0d3
775ba33136b9
Starting new server containers...
3050f23df4c4a5518309d031dd2bca0b8b4064416bd39d6bc8f80950c0240b11
0414c63df057465524709c799993705287565076f37cf56596afb479e6d6e23f
7d74047078efa87a725ef1db94393c649f5db8ab4629f415069a70b94187986f
654b7bc662fd8d6e7587814cd1db924c1b66acbffd7c0734fdaad00ac181ad7f
0c6bd3d2cc52ec15a49058f24b803c18bf50f930221019220f18d2e5f02b7c63
7f1c99f9f2f1a9250e7b86aa848f7871d25eb043e9e8eb705e379abd1684f052
3a7397f1a0bdb172ae5b8c80539f5e4c35d41b7ad92e766280a1b0e452a1f663
6ad940128667d3170a9bfdbb11e229690d8311c1877e747a9f8a9161aa0d8a27
06a1f298fc0c4d696f508c257aea496ea4981c5c37ae4856f77193af8ab32516
0de416ccd931b17f085ce8ffdd381e75fb74316b9a805877d7725d272f2e7b28
```

## Load Balancing

So we've got horizontally scaling 

## Service Discovery

## DNS Basics

# Large Scale Docker

## Problems With Current Solution

## General Strategy - The DCOS

# Mesos

## Abstraction of Docker Hosts

## Scheduling Containers
