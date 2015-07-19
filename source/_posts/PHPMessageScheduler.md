title: Building a Distributed Message Scheduler in PHP
date: 2014-07-21 20:15
tags:
  - php
  - micro-service
  - project
  - message-scheduler
author: Brandon Okert
summary: How I made a simple message scheduler on the weekend
---

Guten Tag!

This weekend I build a little distributed message scheduler. I was recently motivated to learn PHP, and given a recent discussion at work, a message scheduler seemed the way to go. It fit the bill - not only would I be able to use php in a production-like setting, but I would also improve my fluency with distributed systems in general. It was also something I could get done in a reasonably short time - an important trait for an over-eager project starter like me.

## Pic or it Didn't Happen

This is what it looked like this morning:

The Main Server:

![The Main Server Interface](/img/PHPMessageScheduler/MainInterface.png)

Scheduled Messages:

![The Dispatcher Server Interface](/img/PHPMessageScheduler/DispatcherInterface.png)

Check out the [Main Server](https://github.com/bcokert/psched-main) and [Dispatcher](https://github.com/bcokert/psched-dispatcher) on Github.

## What is a "Distributed Message Scheduler"?
Sites like Facebook and Twitter capitalize on the concept of _posts_. A post is basically some text (including links to images, videos, etc.) with an associated poster and post time. A message scheduler in this context is just a system that posts messages at a certain time on behalf of a certain poster.

If you're interested in learning php, or just want to build a reasonable complex system in a relatively short amount of time, a message scheduler is an excellent option. The distributed part is just a bonus that nets you extra scalabiltiy, without it becoming a "build Facebook" sized project.

The multi-server architecture is a little overkill for a personal project, but you can't learn to drive a car if you only play with [Hot Wheels](http://en.wikipedia.org/wiki/Hot_Wheels).

In the real world, it would be computationally infeasable to run both your social site _and_ your message scheduler on the same machine. In a distributed system, your Main Server can take care of things that are already posted, and another server, a _Dispatcher_, can store all the posts to be posted down the road. In a really big system, you could have 1000 Main Servers, each with a pool of Dispatchers.

## How Long Did This Take?
It took me three days, spending about 6 hours each day.

Day one I put together the two servers I'd be using - Installing Ubuntu, installing software, setting up a development environment, setting up [Apache](http://en.wikipedia.org/wiki/Apache_HTTP_Server), etc. I also coded most of the Main Server's interface.

Day two I finished off the interface, then went to work setting up and testing [mysql databases](http://en.wikipedia.org/wiki/MySQL). The main database stores posted posts, and the dispatcher's database stores scheduled posts. I also wrote the various php endpoints that allow posting and scheduling of messages.

Day three was setting up the Dispatcher to automatically post scheduled posts at the right time. Php on the command line was used here, with a little help from [Cron](http://en.wikipedia.org/wiki/Cron). Then it was all testing and polishing, until 18 hours later I had a working system.

## Gimme Architecture
The main server provides two services to the external world: postMessage.php and scheduleMessage.php. The Dispatcher Server provides two corresponding services. Internally, scheduleMessage.php on the Main Server just posts data to the local Dispatcher, and similarly the Dispatcher just forwards data to postMessage.php on the Main Server. Also external is a basic interface for the Main Server, which provides a scheduling form, and a feed viewer.

On the Dispatcher, cron runs every minute, checking the scheduled messages for posts that need to go out. Any it finds are deleted from the Dispatcher's database, then forwarded to the Main Server. The Dispatcher also has a basic interface that allows checking on the scheduled messages.

This image has all the nitty gritty details, and you can find more on [Github](https://github.com/bcokert).
![System Architecture](/img/PHPMessageScheduler/PschedArchitecture.jpg)
