#!/bin/sh -e
#
# Copyright 2018 NXP
#
soc="`cat /proc/device-tree/model |cut -d' ' -f1,2`"
echo "Configuring for $soc..."

config=`ls /usr/local/dpdk/dpaa/usdpaa_config_ls1046.xml`
policy=`ls /usr/local/dpdk/dpaa/usdpaa_policy_hash_ipv4_1queue.xml`

if [ -n "$config" ] && [ -n "$policy" ];then
    /usr/local/bin/fmc -c $config -p $policy -a
fi

echo "FMC configured."
