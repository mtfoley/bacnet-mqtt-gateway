Vue.component('spinner', {
    template: '#spinner'
});

Vue.component('whois', {
    data() {
        return {
            loading: false,
            devices: null
        }
    },
    methods: {
        whois() {
            this.loading = true;
            axios.put('/api/bacnet/scan').then(response => {
                this.devices = response.data;
                this.loading = false;
            });
        },
    }
});

Vue.component('device-scan', {
    data() {
        return {
            loading: false,
            deviceId: null,
            address: null,
            saveConfig: false,
            objects: null
        }
    },
    methods: {
        scanDevice() {
            this.loading = true;
            axios.put('/api/bacnet/' + this.deviceId + '/objects?saveConfig='+this.saveConfig, {
                deviceId: this.deviceId,
                address: this.address
            }).then(response => {
                this.objects = response.data;
                this.loading = false;
            }).catch(error=>{
                this.objects = [];
                this.loading = false;
            });
        },
        getObjects(device) {
            console.log(device);
        }
    }
});

new Vue({
    el: "#app",
    data() {
        return {
            state: null,
        }
    },
    methods: {
        showWhois() {
            this.state = 'whois';
        },
        showObjects() {
            this.state = 'objects';
        }
    }
});