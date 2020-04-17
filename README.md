# BACnet MQTT Gateway

This is an adaptation of Infinite Devices [BACnet MQTT Gateway](https://github.com/infinimesh/bacnet-mqtt-gateway).

BACnet MQTT Gateway is gateway that connects BACnet devices via MQTT to the cloud. It is written in Javascript and uses node. 

I am extending the project to support historian functions, and archiving historical data to a [Haystack](https://project-haystack.org) compliant server. 

The Haystack Client functionality makes use of SkyFoundry's [haystack-auth-node](https://www.npmjs.com/package/@skyfoundry/haystack-auth) NPM package to handle [SCRAM authentication](https://project-haystack.org/doc/Auth).

For BACnet connection the [Node BACstack](https://github.com/fh1ch/node-bacstack) is used.

## Functionalities

* Discover BACnet devices in network (WhoIs)
* Read object list from BACnet device (Read Property)
* Read present value from defined list of BACnet objects and send it to an MQTT broker
* REST and web interface for configuration
* Subscribe to remote commands and publish responses via MQTT (e.g. WhoIs command, Read Object List, Start/Stop polling)
* Create historical records of polled values
* Archive historical records to Haystack server via "commit" and "hisWrite" [REST API endpoints](https://project-haystack.org/doc/Ops)
## Getting started

1. Clone repo and install npm dependencies:

    ```shell
    git clone https://github.com/mtfoley/bacnet-mqtt-gateway.git
    cd bacnet-mqtt-gateway
    npm install
    ```

2. Configure gateway:

    Copy `config/default_example.json` and rename new file to `config/default.json`. 

    The MQTT client has been written to authenticate with an MQTT broker with a username/password, configured along with host and port in `mqtt` section of configuration file.

    The `collector` section does not require any modification.

    The Haystack Client has been written to authenticate with a Haystack Compliant Server, and is currently written with a SkySpark instance in mind, as the REST API endpoints are generated based on the `haystack.project` variable along with other parameters like so:
    `ABOUT: [PROTOCOL]://[HOST]:[PORT]/api/[PROJECT]/about`

    The following is the contents of the 
    
    ```
    {
        "mqtt": {
            "gatewayId": "0x132",
            "host": "mqtt.com",
            "port": 18883,
            "authentication": {
                "username": "",
                "password": ""
            },
            "defaultSchedule": "*/30 * * * * *"
        },
        "collector": {
            "indexFile": "./data/index.json",
            "dataFolder": "./data/"
        },
        "bacnet": {
            "configFolder": "./devices/",
            "defaultSchedule": "*/30 * * * * *"
        },
        "haystack": {
            "gatewayId": "0x132",
            "protocol": "https",
            "host": "haystack.org",
            "project":"example",
            "port": 443,
            "authentication": {
                "username": "username",
                "password": "password"    
            },
            "pingSchedule": "*/30 * * * * *",
            "pushSchedule": "*/5 * * * *"
        },
        "httpServer": {
            "enabled": true,
            "port": 8082
        }
    }

    ```
    
3. Start the gateway and open admin interface

    ```shell
    npm start
    open http://localhost:8082/admin
    ```

## Device polling configuration

The gateway can poll BACnet object present values and send the values via MQTT into the cloud. To configure polling for a BACnet device you can put a .json file into the devices folder.

```json
{
    "device": {
        "deviceId": 114,
        "address": "192.168.178.55"
    },
    "polling": {
        "schedule": "*/15 * * * * *"
    },
    "objects": [{
        "objectId": {
            "type": 2,
            "instance": 202
        }
    }, {
        "objectId": {
            "type": 2,
            "instance": 203
        }
    }]
}
```

You need to define the device id, ip address, schedule interval (as CRON expression) and the objects to poll. 

When the gateway is started it automatically reads the list of files from the directory and starts the polling for all devices.
 
## REST API

To execute commands the gateway offers a REST API under `http://localhost:8082/api/bacnet`.

The following endpoints are supported:

* `PUT /api/bacnet`: Scan for devices (WhoIs)
    
    Scans for BACnet devices in the network (5s) and returns the answers. Body is empty.
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/scan
    ```  
    
* `PUT /api/bacnet/{deviceId}/objects`: Scan device for object

    Scans a specific device for objects and returns the list of found objects. Device ID and IP address must be provided.
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/22/objects
    {
        "deviceId":"22",
        "address":"192.168.178.99"
    }
    ```
    
* `PUT /api/{deviceId}/config`: Configure polling for device

    Configures and starts polling for a specific device. Body is the same as the polling configuration files described in the previous section.
    
    Example:
    ```
    PUT http://localhost:8082/api/bacnet/114/config
    {
        "device": {
            "deviceId": 114,
            "address": "192.168.178.55"
        },
        "polling": {
            "schedule": "*/15 * * * * *"
        },
        "objects": [{
            "objectId": {
                "type": 2,
                "instance": 202
            }
        }, {
            "objectId": {
                "type": 2,
                "instance": 203
            }
        }]
    }
    ```

## Run with Docker

Gateway can also be run as a docker container. Just build the image and start a container:

```shell
docker build -t bacnet-mqtt-gateway
docker run -p 8082:8082 -v /mnt/bacnet-gateway/devices:/usr/src/app/devices -v /mnt/bacnet-gateway/config:/usr/src/app/config bacnet-mqtt-gateway
```

With the specified file mountings you can put the config file under `/mnt/bacnet-gateway/config` and the device configs under `/mnt/bacnet-gateway/devices` on the host system.

## DOCS TODO

I will be adding the following docs in a later commit:
* MQTT Command and Command Results
* More Detail on BACnet Object Types supported (AI/AO/AV, BI/BO/BV, MSI/MSO/MSV)
* More Detail on how Haystack client works

## CODE TODO

I will be adding the following functionality in a later commit:
* ~~ Use more generically derived value for "gatewayId" value instead of that found in `config/default.json` file (e.g. using node-machine-id package?). ~~
* Detect and record ReadPropertyMultiple support in a device. Use this support value to more effectively read objects from BACnet devices.
* Use templates in device polling configuration file(s), to account for multiple devices with the same effective objects lists (very common, especially with B-ASC profiles).
* Update device polling configurations to allow designation of whether or not to trend an object value.
* Allow updating of device polling configurations via MQTT subscribed topic
* Improve Haystack representation to include device name as well as object names.