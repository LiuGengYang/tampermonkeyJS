// ==UserScript==
// @name         下载淘宝商品图
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://item.taobao.com/item.htm*
// @require      https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/jszip/3.7.1/jszip.min.js
// @require      https://lf9-cdn-tos.bytecdntp.com/cdn/expire-1-M/regenerator-runtime/0.13.5/runtime.js
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_download 
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';
    const quality = 1; //压缩比例
    let buttonStyle = `
        #downloadBtn {
            position: fixed;
            width: 200px;
            height: 50px;
            line-height: 50px;
            font-size: 20px;
            text-align: center;
            bottom: 50px;
            right: 50px;
            background: white;
            padding: 4px;
            border-radius: 4px;
            box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 0px 1px;
            user-select: none;
            cursor:pointer;
            z-index: 999999999;
            color: rgb(25, 118, 210);
        }
    `
    GM_addStyle(buttonStyle)

    let DIV = document.createElement('div')
    DIV.id = "downloadBtn"
    DIV.innerHTML = "下载商品图"
    document.body.appendChild(DIV)

    document.getElementById("downloadBtn").addEventListener("click", function (e) {
        let height = document.documentElement.scrollHeight;
        let list = Array.from(document.querySelectorAll("#J_UlThumb img"))
        let descList = Array.from(document.querySelectorAll("#J_DivItemDesc img"))
        let attrList = Array.from(document.querySelectorAll(".attributes-list li"))
        let price = document.querySelector("#J_StrPrice .tb-rmb-num").innerHTML
        var zip = new JSZip();
        let promiseList = [list.map((item, index) => {
            return new Promise(async (resolve, reject) => {
                let src = await getBase64(item.src.replace(/50x50/g, "800x800"))
                zip.file(`主图-${(index + 1).toString().padStart(2, "0")}.jpg`, src, { base64: true });
                resolve()
            })
        }), descList.map((item, index) => {
            return new Promise(async (resolve, reject) => {
                let src = await getBase64(item.dataset.ksLazyload || item.dataset.src || item.currentSrc || item.src)
                zip.file(`详情-${(index + 1).toString().padStart(2, "0")}.jpg`, src, { base64: true });
                resolve()
            })
        })].flat(2);
        let promise = Promise.all(promiseList)
        let attrText = attrList.map(item => item.innerText + "\n").join(",").replace(/,/g, "")
        zip.file("pageInfo.txt", `${window.location.href}\n${attrText}价格:${price}`);
        promise.then(() => {
            zip.generateAsync({ type: "base64" })
                .then(function (content) {
                    downloadFile("data:application/zip;base64," + content, document.title + ".zip")
                });
        })
    })

    function downloadFile(filePath, name) {
        const link = document.createElement('a')
        link.style.display = 'none'
        link.href = filePath
        link.setAttribute(
            'download',
            name
        )
        document.body.appendChild(link)
        link.click()
    }

    function getBase64(imgUrl) {
        return new Promise((resolve) => {
            const image = new Image();
            image.crossOrigin = "";
            image.src = imgUrl;
            image.onload = function () {
                let canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                let context = canvas.getContext("2d");
                context.drawImage(image, 0, 0, image.width, image.height);
                compressImg(canvas.toDataURL("image/jpg", 1), quality).then((res) => {
                    resolve(res.split(",")[1])
                })
            };
        });
    }

    function compressImg(base64, multiple) {
        return new Promise((resolve, reject) => {

            if (!base64) {
                return
            }
            const length = base64.length / 1024
            let newImage = new Image()
            let quality = 1
            newImage.src = base64
            newImage.setAttribute('crossOrigin', 'Anonymous')
            let imgWidth,
                imgHeight
            let w = undefined
            newImage.onload = function () {
                w = this.width * multiple
                imgWidth = this.width
                imgHeight = this.height
                let canvas = document.createElement('canvas')
                let ctx = canvas.getContext('2d')
                if (Math.max(imgWidth, imgHeight) > w) {
                    if (imgWidth > imgHeight) {
                        canvas.width = w
                        canvas.height = w * (imgHeight / imgWidth)
                    } else {
                        canvas.height = w
                        canvas.width = w * (imgWidth / imgHeight)
                    }
                } else {
                    canvas.width = imgWidth
                    canvas.height = imgHeight
                    quality = 0.6
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(this, 0, 0, canvas.width, canvas.height)
                let smallBase64 = canvas.toDataURL('image/jpeg', quality)
                resolve(smallBase64)
            }
        })
    }

})();

