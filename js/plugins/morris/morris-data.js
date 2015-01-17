$(function() {

    Morris.Area({
        element: 'morris-area-chart',
        data: [{
            period: '2010 Q1',
            properties: 1,
        }, {
            period: '2012 Q1',
            properties: 3,
        }, {
            period: '2014 Q3',
            properties: 2,
        }],
        xkey: 'period',
        ykeys: ['properties'],
        labels: ['Number of properties'],
        pointSize: 2,
        hideHover: 'auto',
        resize: true
    });


});
