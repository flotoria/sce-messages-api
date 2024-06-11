#include <iostream>
#include <string>
#include <curl/curl.h>

size_t write_callback(char* ptr, size_t size, size_t nmemb, void* userdata)
{
    std::string s(ptr, size * nmemb);
    std::cout << s << std::endl;
    return size * nmemb;
}

void connect_to_sse_endpoint(const std::string &url) {
    CURL* curl;
    CURLcode res;

    std::cout << "connecting to sse endpoint: " << url << std::endl;

    curl_global_init(CURL_GLOBAL_ALL);
    curl = curl_easy_init();
    if(curl) {
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, NULL);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 0L);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, curl_slist_append(NULL, "Accept: text/event-stream"));

        res = curl_easy_perform(curl);

        if(res != CURLE_OK) {
            std::cerr << "fail: " << curl_easy_strerror(res) << std::endl;
        }

        curl_easy_cleanup(curl);
    }

    curl_global_cleanup();
}


int main() {

    connect_to_sse_endpoint("http://localhost:5000/listen?apiKey=key1&id=1");

    return 0;
}