#!/usr/bin/env bash
set -e

function error {
  echo -e "\n\x1B[31m$1\x1b[0m"
  exit 1
}

function info {
  echo -e "\n\x1B[1m$1\x1b[0m"
}

if [ ! -e "config.yaml" ]; then
  error "Must run from root directory (where config.yaml is)"
fi

info "Ensuring build directory is ready"
if [ ! -d "public" ]; then
  git submodule init
  git submodule update public
  cd public
  git checkout master
  cd ..
fi

info "Cleaning up old site"
rm -r public/*

info "Building site"
hugo

info "Adding updates to site"
cd public
if [ -z $(git status -s) ]; then
  info "No changes to deploy, aborting deploy"
  exit 0
fi
git add -A
git commit -m "Automated deploy"

info "Deploying Site"
git push origin master

info "Updating source project with new site commit (submodule commit)"
cd ..
git add -A
git commit -m "Automated deploy"
git push origin master

exit 0
