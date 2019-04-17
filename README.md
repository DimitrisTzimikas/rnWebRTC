# rnWebRTC

## Configuration (Works on iOS & Android)
**react: 16.8.3**

**react-native: 0.59.4**

**react-native-webrtc: 1.69.1**

## Install
**Android**

-  ```git clone "url"```
-  ```cd rnWebRTC```
-  ```npm i```
-  ```react-native run-android```

**iOS**

-  ```git clone "url"```
-  ```cd rnWebRTC```
-  ```npm i```
-  open Xcode
-  on top left select *iPhone* from *Device* and click the play button

## Instructions
- For this to work you need to create the server, go to : [RCTWebRTCDemo-server](https://github.com/DimitrisTzimikas/RCTWebRTCDemo-server) and follow the instructions.

- After you create the server and deploy it with ngrok copy the link, something like that "https://a4cd7858.ngrok.io" and paste it to ```rnWebRTC/src/App.js``` 
```javascript
const url = 'paste_it_here';
```
- It must look like than
```javascript
const url = 'https://a4cd7858.ngrok.io/';
```

# Note 
- Whenever you change the ngrok link you must follow the same routine. 
